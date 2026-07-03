# C# Standards - Messaging

> **Module:** messaging.md | **Parent:** [index.md](index.md)

This module covers asynchronous messaging for .NET services using **MassTransit** over
RabbitMQ or Azure Service Bus: consumers, producers, the transactional outbox, retry and
redelivery policies, and dead-letter handling.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards, and
> [../csharp.md](../csharp.md) for the Result pattern, OpenTelemetry, Serilog, and
> `CancellationToken` conventions used below. See also
> [../csharp.md#rabbitmq-worker-pattern](../csharp.md#rabbitmq-worker-pattern) for
> `BackgroundService` worker lifecycle.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Transport Selection](#transport-selection) | MassTransit over RabbitMQ vs Azure Service Bus |
| 2 | [Bus Configuration](#bus-configuration) | Registering MassTransit and the transport |
| 3 | [Message Contracts](#message-contracts) | Events vs commands, versioning |
| 4 | [Consumers](#consumers) | Consumer implementation and idempotency |
| 5 | [Producers](#producers-publish-vs-send) | Publish (events) vs Send (commands) |
| 6 | [Retry, Redelivery, and DLQ (MANDATORY)](#retry-redelivery-and-dlq-mandatory) | Exponential backoff with jitter, error queues |
| 7 | [Transactional Outbox (MANDATORY for dual writes)](#transactional-outbox-mandatory-for-dual-writes) | Atomic DB write + message publish |
| 8 | [Observability](#observability) | OpenTelemetry instrumentation |
| 9 | [Anti-Rationalization Table](#anti-rationalization-table) | Common excuses and required actions |
| 10 | [Checklist](#checklist) | Pre-submission verification |

---

## Transport Selection

| Transport | Use When |
|-----------|----------|
| **RabbitMQ** | Self-hosted or containerized brokers; fine-grained exchange/routing control |
| **Azure Service Bus** | Azure-native deployments; sessions, scheduled delivery, managed DLQ |
| **In-Memory** | Tests only — never production |

MassTransit abstracts the transport, so consumer/producer code is identical across
RabbitMQ and Azure Service Bus. Choose the transport in configuration, not in handlers.
This is an infrastructure decision — **STOP and confirm with the requester** if it is not
already fixed in `PROJECT_RULES.md`.

---

## Bus Configuration

```csharp
// Program.cs
builder.Services.AddMassTransit(x =>
{
    // Kebab-case queue names derived from consumer type names.
    x.SetKebabCaseEndpointNameFormatter();

    x.AddConsumer<BalanceCreatedConsumer>(cfg =>
    {
        // Per-consumer retry: 5 attempts with exponential backoff + jitter.
        cfg.UseMessageRetry(r => r.Exponential(
            retryLimit: 5,
            minInterval: TimeSpan.FromMilliseconds(500),
            maxInterval: TimeSpan.FromSeconds(30),
            intervalDelta: TimeSpan.FromSeconds(2)));
    });

    x.UsingRabbitMq((context, cfg) =>
    {
        cfg.Host(builder.Configuration.GetConnectionString("RabbitMq"));

        // Second-level (delayed) redelivery moves the message off the active queue
        // between attempts so it does not block other messages.
        cfg.UseDelayedRedelivery(r => r.Intervals(
            TimeSpan.FromMinutes(1),
            TimeSpan.FromMinutes(5),
            TimeSpan.FromMinutes(15)));

        cfg.ConfigureEndpoints(context);
    });
});
```

For Azure Service Bus, swap the transport block — everything else stays the same:

```csharp
x.UsingAzureServiceBus((context, cfg) =>
{
    cfg.Host(builder.Configuration.GetConnectionString("ServiceBus"));
    cfg.ConfigureEndpoints(context);
});
```

---

## Message Contracts

Model messages as immutable `record` types in a shared contracts assembly. Distinguish
**events** (something happened, past tense, multiple consumers allowed) from **commands**
(do something, imperative, one logical handler).

```csharp
// Event: past tense, published fan-out.
public sealed record BalanceCreated
{
    public required Guid BalanceId { get; init; }
    public required Guid AccountId { get; init; }
    public required decimal Amount { get; init; }
    public required DateTimeOffset OccurredAt { get; init; }
}

// Command: imperative, sent to one endpoint.
public sealed record CreateBalance
{
    public required Guid AccountId { get; init; }
    public required decimal Amount { get; init; }
}
```

**Versioning:** add new optional properties only. For breaking changes, publish a new
contract type (`BalanceCreatedV2`) and run both consumers during migration — never mutate
a deployed contract in place.

---

## Consumers

Consumers MUST be **idempotent** — the broker guarantees at-least-once delivery, so the
same message can arrive more than once (redelivery, broker failover, retry). Deduplicate
on a natural key or use the [inbox pattern](#transactional-outbox-mandatory-for-dual-writes).

```csharp
public sealed class BalanceCreatedConsumer : IConsumer<BalanceCreated>
{
    private static readonly ActivitySource ActivitySource = new("Svc.Messaging");

    private readonly IBalanceService _service;
    private readonly ILogger<BalanceCreatedConsumer> _logger;

    public BalanceCreatedConsumer(IBalanceService service, ILogger<BalanceCreatedConsumer> logger)
    {
        _service = service;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<BalanceCreated> context)
    {
        using var activity = ActivitySource.StartActivity("consumer.balance_created");
        activity?.SetTag("balance.id", context.Message.BalanceId);

        var ct = context.CancellationToken;
        _logger.LogInformation("Processing BalanceCreated {BalanceId}", context.Message.BalanceId);

        var result = await _service.ApplyAsync(context.Message, ct);
        if (result.IsFailure)
        {
            // Non-retryable (validation/business) → do NOT throw; the message is poison.
            if (result.Error.IsBusinessError)
            {
                activity?.AddEvent(new ActivityEvent("non_retryable_error"));
                _logger.LogWarning("Non-retryable error for {BalanceId}: {Code}",
                    context.Message.BalanceId, result.Error.Code);
                return; // consumed; will not be redelivered
            }

            // Transient (technical) → throw so MassTransit retry/redelivery kicks in.
            activity?.SetStatus(ActivityStatusCode.Error, result.Error.Message);
            throw new TransientMessageException(result.Error.Message);
        }
    }
}
```

### Retry vs poison: error classification (MANDATORY)

| Category | Examples | Action |
|----------|----------|--------|
| **Transient** (retryable) | Network timeout, DB deadlock, downstream 5xx, pool exhaustion | **Throw** — retry, then delayed redelivery, then DLQ |
| **Business / validation** (non-retryable) | Invalid input, duplicate key, domain rule violation | **Return** — do not throw; the same input will fail again |
| **Cancellation** | `OperationCanceledException` from shutdown | Let it propagate; do not treat as a failure |

Throwing for a business error wastes the entire retry budget on a message that can never
succeed and then dead-letters it needlessly.

---

## Producers (Publish vs Send)

| Method | Semantics | Use For |
|--------|-----------|---------|
| `IPublishEndpoint.Publish` | Fan-out to all subscribers | Events (`BalanceCreated`) |
| `ISendEndpoint.Send` | Point-to-point to one queue | Commands (`CreateBalance`) |

```csharp
public sealed class BalanceService : IBalanceService
{
    private static readonly ActivitySource ActivitySource = new("Svc.Messaging");

    private readonly IPublishEndpoint _publish;

    public BalanceService(IPublishEndpoint publish) => _publish = publish;

    public async Task<Result<Unit, AppError>> CreateAsync(CreateBalance command, CancellationToken ct)
    {
        using var activity = ActivitySource.StartActivity("service.balance.create");

        // ... persist, then publish the event ...
        await _publish.Publish(new BalanceCreated
        {
            BalanceId = Guid.NewGuid(),
            AccountId = command.AccountId,
            Amount = command.Amount,
            OccurredAt = DateTimeOffset.UtcNow,
        }, ct);

        return Result.Success<Unit, AppError>(Unit.Value);
    }
}
```

> **Dual-write hazard:** publishing directly from a handler that also writes the database
> is not atomic — the DB commit can succeed and the publish fail (or vice versa). For any
> handler that both writes state and emits a message, use the
> [transactional outbox](#transactional-outbox-mandatory-for-dual-writes).

---

## Retry, Redelivery, and DLQ (MANDATORY)

Immediate infinite retries cause message storms and connection exhaustion. Every consumer
MUST use exponential backoff with jitter and a bounded attempt count.

**HARD GATE:** all consumers MUST configure `UseMessageRetry` (in-memory, fast attempts)
and services MUST configure `UseDelayedRedelivery` (broker-level, spaced attempts) so
failures move off the active queue between attempts.

### Two-layer policy

| Layer | Mechanism | Timescale | Purpose |
|-------|-----------|-----------|---------|
| First-level retry | `UseMessageRetry(Exponential(...))` | ms → seconds | Ride out brief transient blips in-process |
| Second-level redelivery | `UseDelayedRedelivery(Intervals(...))` | minutes | Wait out longer downstream outages without blocking the queue |
| Dead-letter | Automatic `*_error` queue | terminal | Park poison messages for inspection/replay |

MassTransit's `Exponential` policy applies jitter internally, preventing the thundering
herd when many consumers retry simultaneously. After both layers are exhausted, MassTransit
automatically moves the message to the `<queue>_error` dead-letter queue — never write a
custom infinite-retry loop.

### Dead-letter handling

- Monitor `*_error` queue depth and alert when it grows.
- Provide a replay path (a `BackgroundService` or admin endpoint) to re-publish messages
  from the error queue after the root cause is fixed.
- Never auto-drain the error queue back into the active queue without a fix — that
  recreates the storm.

### Forbidden patterns

```csharp
// FORBIDDEN: manual infinite retry loop inside a consumer.
while (true)
{
    try { await Process(); break; }
    catch { /* retry forever — stuck message, no backoff */ }
}

// FORBIDDEN: Task.Delay-based fixed retry (no jitter, blocks the consumer).
await Task.Delay(TimeSpan.FromSeconds(1));

// FORBIDDEN: swallowing transient errors so the message is silently lost.
catch (Exception) { /* nothing */ }
```

---

## Transactional Outbox (MANDATORY for dual writes)

When a handler both **writes the database** and **publishes a message**, the two actions
MUST be atomic. The outbox stores outgoing messages in the same database transaction as the
business data; a delivery process then relays them to the broker. MassTransit ships an EF
Core outbox — use it rather than hand-rolling one.

```csharp
// Program.cs
builder.Services.AddMassTransit(x =>
{
    x.AddEntityFrameworkOutbox<AppDbContext>(o =>
    {
        o.UsePostgres();
        o.UseBusOutbox(); // publishes are staged in the DB transaction, relayed after commit
        o.QueryDelay = TimeSpan.FromSeconds(1);
    });

    x.AddConsumer<BalanceCreatedConsumer>();
    x.UsingRabbitMq((context, cfg) => cfg.ConfigureEndpoints(context));
});
```

```csharp
public async Task<Result<Unit, AppError>> CreateAsync(CreateBalance command, CancellationToken ct)
{
    using var activity = ActivitySource.StartActivity("service.balance.create");

    var balance = Balance.Create(command.AccountId, command.Amount);
    _dbContext.Balances.Add(balance);

    // Staged in the outbox table within the SAME transaction as the insert above.
    await _publish.Publish(new BalanceCreated
    {
        BalanceId = balance.Id,
        AccountId = balance.AccountId,
        Amount = balance.Amount,
        OccurredAt = DateTimeOffset.UtcNow,
    }, ct);

    // One atomic commit persists the balance AND the outbox message.
    await _dbContext.SaveChangesAsync(ct);
    return Result.Success<Unit, AppError>(Unit.Value);
}
```

**Inbox (consumer-side dedup):** the EF Core outbox also provides an inbox that records
processed `MessageId`s, giving exactly-once processing semantics on top of at-least-once
delivery. Enable it for consumers whose side effects are not naturally idempotent.

**Compliance requirements:**
- MUST use the outbox for any handler that writes the DB and publishes a message.
- MUST run the outbox migration (`AddEntityFrameworkOutbox` creates the tables).
- SHOULD enable the inbox for non-idempotent consumers.

---

## Observability

- Every consumer and producer method MUST create an `ActivitySource.StartActivity` span.
- Register MassTransit's OpenTelemetry instrumentation so spans link publish → consume:

```csharp
builder.Services.AddOpenTelemetry()
    .WithTracing(t => t.AddSource("MassTransit"))
    .WithMetrics(m => m.AddMeter("MassTransit"));
```

- Set `ActivityStatusCode.Error` for technical failures; use `AddEvent` for business
  outcomes (do not mark business validation as an error span).
- Log with `ILogger<T>` and structured properties (never string interpolation, never
  `Console.Write`).

---

## Anti-Rationalization Table

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Consumers are naturally idempotent" | At-least-once delivery redelivers messages; a non-idempotent side effect duplicates. | **Deduplicate on a key or enable the inbox** |
| "Publish then SaveChanges is fine" | Not atomic: the publish can succeed and the commit fail, emitting a phantom event. | **Use the transactional outbox** |
| "Fixed retry delay is simpler" | Fixed delays synchronize retries into a thundering herd. | **Use `Exponential` with jitter** |
| "Throw on validation errors, retry sorts it" | Same input fails every attempt, wasting the budget and dead-lettering needlessly. | **Return for business errors; throw only for transient** |
| "Infinite retry so nothing is lost" | An unfixable message loops forever and blocks the queue. | **Bound retries; let it dead-letter** |
| "DLQ can be ignored" | Poison messages accumulate silently and mask data loss. | **Monitor and alert on `*_error` depth** |
| "We only have one consumer, order is guaranteed" | Retries and redelivery reorder messages. | **Design for out-of-order, at-least-once delivery** |

---

## Checklist

Before submitting messaging code, verify:

- [ ] Transport chosen in configuration (RabbitMQ or Azure Service Bus), fixed in `PROJECT_RULES.md`
- [ ] Message contracts are immutable `record`s; events past-tense, commands imperative
- [ ] Contract changes are additive; breaking changes use a new versioned type
- [ ] Consumers are idempotent (natural-key dedup or inbox)
- [ ] `UseMessageRetry(Exponential(...))` configured per consumer
- [ ] `UseDelayedRedelivery(Intervals(...))` configured on the bus
- [ ] Business errors `return`; transient errors `throw` (correct classification)
- [ ] No manual infinite retry loops, no fixed `Task.Delay` retries, no swallowed exceptions
- [ ] Dual-write handlers use the EF Core transactional outbox (`UseBusOutbox`)
- [ ] Inbox enabled for non-idempotent consumers
- [ ] `*_error` (DLQ) depth is monitored; a replay path exists
- [ ] MassTransit OpenTelemetry source/meter registered
- [ ] Every consumer/producer method has an `ActivitySource.StartActivity` span
- [ ] `CancellationToken` (from `ConsumeContext`) propagated to all async calls
- [ ] `ILogger<T>` used for all logging (no `Console.Write`)

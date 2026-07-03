# C# Standards - Domain Patterns

> **Module:** domain.md | **Parent:** [index.md](index.md)

This module defines domain modeling for C# services: the always-valid domain model, value
objects, aggregates, domain events, the error-codes convention, the `Result<T>` error-handling
pattern, and persistence transformation between domain entities and database models.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Always-Valid Domain Model (MANDATORY)](#always-valid-domain-model-mandatory) | Factory validation, invariant protection |
| 2 | [Value Objects (MANDATORY)](#value-objects-mandatory) | Immutable, self-validating values |
| 3 | [Aggregates & Aggregate Roots](#aggregates--aggregate-roots) | Consistency boundaries |
| 4 | [Domain Events](#domain-events) | Recording and dispatching events |
| 5 | [Error Codes Convention (MANDATORY)](#error-codes-convention-mandatory) | Service-prefixed error codes |
| 6 | [Error Handling: Result Pattern (MANDATORY)](#error-handling-result-pattern-mandatory) | `Result<TValue, TError>` |
| 7 | [Persistence Transformation (MANDATORY)](#persistence-transformation-mandatory) | Entity ↔ database model mapping |

---

## Always-Valid Domain Model (MANDATORY)

A domain object MUST be impossible to construct in an invalid state. Validation happens **once**,
at creation, and invariants are protected thereafter. Anemic entities with public setters and
external validation are **FORBIDDEN**.

### Why This Pattern Is Mandatory

| Without it | With always-valid model |
|------------|-------------------------|
| Validation scattered across services | Validation centralized in the factory |
| Objects can drift into invalid states | Invariants hold for the object's whole lifetime |
| Every consumer must re-check the same rules | Consumers trust the type |
| Bugs surface far from their cause | Invalid input rejected at the boundary |

### The Pattern

- Private constructor. No public parameterless constructor for entities with invariants.
- A static factory (`Create`) that returns `Result<TEntity, DomainError>`.
- No public setters. State changes go through intention-revealing methods that re-check invariants.
- A separate `Reconstruct`/`Load` path for rehydration from the database (already-valid data).

```csharp
namespace YourService.Domain.Invoices;

public sealed class Invoice
{
    public InvoiceId Id { get; }
    public CustomerId CustomerId { get; }
    public Money Total { get; private set; }
    public InvoiceStatus Status { get; private set; }
    public DateTimeOffset CreatedAt { get; }

    // Private constructor — construction only via factory or reconstruction.
    private Invoice(InvoiceId id, CustomerId customerId, Money total,
                    InvoiceStatus status, DateTimeOffset createdAt)
    {
        Id = id;
        CustomerId = customerId;
        Total = total;
        Status = status;
        CreatedAt = createdAt;
    }

    // Factory — validates and returns a Result. The only way to create a NEW invoice.
    public static Result<Invoice, DomainError> Create(CustomerId customerId, Money total)
    {
        if (total.Amount <= 0)
            return DomainError.Validation("Invoice total must be positive");

        return new Invoice(
            InvoiceId.New(), customerId, total,
            InvoiceStatus.Pending, DateTimeOffset.UtcNow);
    }

    // Behavior — enforces the state machine, never a public setter.
    public Result<Unit, DomainError> MarkPaid()
    {
        if (Status == InvoiceStatus.Cancelled)
            return DomainError.Conflict("Cannot pay a cancelled invoice");

        Status = InvoiceStatus.Paid;
        return Unit.Value;
    }

    // Reconstruction — trusted data from the database, no re-validation.
    public static Invoice Reconstruct(InvoiceId id, CustomerId customerId, Money total,
                                      InvoiceStatus status, DateTimeOffset createdAt)
        => new(id, customerId, total, status, createdAt);
}
```

### Requirements Checklist

| # | Requirement |
|---|-------------|
| 1 | Private constructor |
| 2 | Static `Create` factory returning `Result<TEntity, DomainError>` |
| 3 | No public setters (use `private set` / `init` and behavior methods) |
| 4 | State transitions validate invariants and return `Result` on failure |
| 5 | Separate `Reconstruct`/`Load` for database rehydration (no re-validation) |

### FORBIDDEN

```csharp
// FORBIDDEN: anemic entity with public setters, no factory, external validation
public sealed class Invoice
{
    public decimal Total { get; set; }          // mutable, unvalidated
    public string Status { get; set; } = "";     // stringly-typed state
}
var invoice = new Invoice { Total = -5 };         // invalid object exists
```

---

## Value Objects (MANDATORY)

Concepts defined by their attributes (not an identity) MUST be modeled as immutable, self-
validating value objects — never as bare primitives. This eliminates primitive obsession
(`string currency`, `decimal amount`) and centralizes formatting/validation.

```csharp
public readonly record struct Money
{
    public decimal Amount { get; }
    public string Currency { get; }

    private Money(decimal amount, string currency)
    {
        Amount = amount;
        Currency = currency;
    }

    public static Result<Money, DomainError> Create(decimal amount, string currency)
    {
        if (string.IsNullOrWhiteSpace(currency) || currency.Length != 3)
            return DomainError.Validation("Currency must be a 3-letter ISO code");

        return new Money(decimal.Round(amount, 2), currency.ToUpperInvariant());
    }

    public Result<Money, DomainError> Add(Money other) =>
        other.Currency == Currency
            ? new Money(Amount + other.Amount, Currency)
            : DomainError.Validation("Cannot add different currencies");
}
```

```csharp
// Strongly-typed identifiers prevent mixing ids of different entities.
public readonly record struct InvoiceId(Guid Value)
{
    public static InvoiceId New() => new(Guid.NewGuid());
    public override string ToString() => Value.ToString();
}
```

**Rules:**
- Value objects are immutable (`readonly record struct` for small ones, `sealed record` for larger).
- Value equality is by contents — records give this for free.
- Self-validate in a static factory; expose no way to build an invalid value.
- Prefer strongly-typed IDs over raw `Guid`/`string` to prevent argument-order bugs.

---

## Aggregates & Aggregate Roots

An aggregate is a cluster of entities and value objects treated as a single consistency boundary.
The **aggregate root** is the only entry point; external code references the aggregate solely
through the root.

**Rules:**
- Only the aggregate root is fetched and saved by repositories (one repository per aggregate root).
- Enforce all invariants that span the aggregate inside the root's methods.
- Reference other aggregates by **id**, not by object reference, to keep boundaries clean.
- Keep aggregates small; a large aggregate becomes a contention and consistency bottleneck.

```csharp
public sealed class Order   // aggregate root
{
    private readonly List<OrderLine> _lines = [];    // internal entities
    public OrderId Id { get; }
    public IReadOnlyList<OrderLine> Lines => _lines.AsReadOnly();
    public Money Total => _lines.Aggregate(Money.Zero, (sum, l) => sum.Add(l.Subtotal).Value);

    // Mutation of children goes THROUGH the root so invariants are enforced.
    public Result<Unit, DomainError> AddLine(ProductId productId, int quantity, Money unitPrice)
    {
        if (quantity <= 0)
            return DomainError.Validation("Quantity must be positive");

        _lines.Add(OrderLine.Create(productId, quantity, unitPrice));
        return Unit.Value;
    }
}
```

---

## Domain Events

Domain events record something meaningful that happened in the domain. The aggregate raises them;
the application layer dispatches them after the transaction commits.

```csharp
// Domain/Common/IDomainEvent.cs
public interface IDomainEvent
{
    DateTimeOffset OccurredAt { get; }
}

// Domain/Invoices/InvoicePaidEvent.cs
public sealed record InvoicePaidEvent(InvoiceId InvoiceId, Money Amount) : IDomainEvent
{
    public DateTimeOffset OccurredAt { get; } = DateTimeOffset.UtcNow;
}
```

```csharp
// Domain/Common/Entity.cs — base that collects events
public abstract class AggregateRoot
{
    private readonly List<IDomainEvent> _domainEvents = [];
    public IReadOnlyList<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    protected void Raise(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
    public void ClearDomainEvents() => _domainEvents.Clear();
}
```

```csharp
// Inside the aggregate: raise on state change
public Result<Unit, DomainError> MarkPaid()
{
    if (Status == InvoiceStatus.Cancelled)
        return DomainError.Conflict("Cannot pay a cancelled invoice");

    Status = InvoiceStatus.Paid;
    Raise(new InvoicePaidEvent(Id, Total));
    return Unit.Value;
}
```

**Dispatching rules:**
- Collect events on the aggregate; publish them after `SaveChangesAsync` succeeds (e.g. via an EF
  Core `SaveChanges` interceptor or an outbox), so events never fire for a rolled-back transaction.
- Handlers live in the Application layer; the Domain only declares the event.
- For cross-service integration events, use a transactional **outbox** rather than publishing
  directly to a broker mid-transaction.

---

## Error Codes Convention (MANDATORY)

Each service MUST define error codes with a service-specific prefix so errors are greppable and
stable across API responses and logs.

### Service Prefixes (example)

| Service | Prefix | Example |
|---------|--------|---------|
| Platform | `PLT` | `PLT-0001` |
| Billing | `BIL` | `BIL-0001` |
| Auth | `AUT` | `AUT-0001` |

### Error Code Catalog

```csharp
// Domain/Errors/ErrorCodes.cs
public static class ErrorCodes
{
    public const string InvalidInput      = "PLT-0001";
    public const string NotFound          = "PLT-0002";
    public const string Unauthorized      = "PLT-0003";
    public const string Forbidden         = "PLT-0004";
    public const string Conflict          = "PLT-0005";
    public const string UnprocessableRule = "PLT-0006";
    public const string InternalError     = "PLT-0007";
}
```

### DomainError Type

```csharp
// Domain/Errors/DomainError.cs
public sealed record DomainError
{
    public string Code { get; }
    public string Message { get; }
    public int StatusCode { get; }
    public IReadOnlyDictionary<string, object?>? Details { get; }

    private DomainError(string code, string message, int statusCode,
                        IReadOnlyDictionary<string, object?>? details = null)
    {
        Code = code;
        Message = message;
        StatusCode = statusCode;
        Details = details;
    }

    public bool IsNotFound   => StatusCode == 404;
    public bool IsValidation => StatusCode == 400;
    public bool IsConflict   => StatusCode == 409;

    public static DomainError Validation(string message, IReadOnlyDictionary<string, object?>? details = null)
        => new(ErrorCodes.InvalidInput, message, 400, details);

    public static DomainError NotFound(string entity, object id)
        => new(ErrorCodes.NotFound, $"{entity} with id '{id}' was not found", 404);

    public static DomainError Conflict(string message)
        => new(ErrorCodes.Conflict, message, 409);

    public static DomainError Unprocessable(string message)
        => new(ErrorCodes.UnprocessableRule, message, 422);

    public static DomainError Internal(string message)
        => new(ErrorCodes.InternalError, message, 500);
}
```

> The API layer maps `DomainError` → `ProblemDetails` (RFC 7807). See
> [api-patterns.md](api-patterns.md#problemdetails--rfc-7807-mandatory).

---

## Error Handling: Result Pattern (MANDATORY)

Expected/business failures MUST be modeled with `Result<TValue, TError>`, not exceptions.
Exceptions are reserved for truly exceptional, unexpected conditions. Generic
`throw new Exception(...)` and empty `catch` blocks are **FORBIDDEN**.

```csharp
// Domain/Common/Result.cs
public readonly struct Result<TValue, TError>
{
    private readonly TValue? _value;
    private readonly TError? _error;

    public bool IsSuccess { get; }
    public bool IsFailure => !IsSuccess;

    public TValue Value => IsSuccess
        ? _value! : throw new InvalidOperationException("No value on a failure result");
    public TError Error => IsFailure
        ? _error! : throw new InvalidOperationException("No error on a success result");

    private Result(TValue value) { _value = value; IsSuccess = true; }
    private Result(TError error) { _error = error; IsSuccess = false; }

    public static implicit operator Result<TValue, TError>(TValue value) => new(value);
    public static implicit operator Result<TValue, TError>(TError error) => new(error);

    public TResult Match<TResult>(Func<TValue, TResult> onSuccess, Func<TError, TResult> onError)
        => IsSuccess ? onSuccess(_value!) : onError(_error!);
}

// Unit — for operations that succeed with no value.
public readonly record struct Unit
{
    public static readonly Unit Value = default;
}
```

### Usage

```csharp
public async Task<Result<InvoiceResponse, DomainError>> CreateAsync(
    CreateInvoiceCommand command, CancellationToken cancellationToken)
{
    var money = Money.Create(command.Amount, command.Currency);
    if (money.IsFailure) return money.Error;             // implicit conversion

    var invoice = Invoice.Create(new CustomerId(command.CustomerId), money.Value);
    if (invoice.IsFailure) return invoice.Error;

    await _repository.AddAsync(invoice.Value, cancellationToken);
    return InvoiceResponse.FromEntity(invoice.Value);    // implicit conversion
}
```

### FORBIDDEN

```csharp
// FORBIDDEN: generic exception for a business rule
if (amount <= 0) throw new Exception("bad amount");        // use Result / DomainError

// FORBIDDEN: swallowing exceptions
try { ... } catch (Exception) { }                          // never silently ignore
try { ... } catch (Exception) { return null; }             // never hide errors

// CORRECT: expected failure via Result
if (amount <= 0) return DomainError.Validation("Amount must be positive");

// CORRECT: specific exception for genuinely exceptional cases
throw new InvoiceNotFoundException(invoiceId);
```

---

## Persistence Transformation (MANDATORY)

The domain MUST NOT depend on database concerns. Map explicitly between domain entities and
persistence models. Two idiomatic approaches — pick one per project:

### Option A: EF Core mapping the domain directly

Configure EF Core to persist the domain entity (value-object conversions, private setters,
backing fields) so no separate model is needed.

```csharp
// Infrastructure/Persistence/Configurations/InvoiceConfiguration.cs
public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.HasKey(i => i.Id);
        builder.Property(i => i.Id)
            .HasConversion(id => id.Value, value => new InvoiceId(value));

        builder.OwnsOne(i => i.Total, money =>
        {
            money.Property(m => m.Amount).HasColumnName("total_amount");
            money.Property(m => m.Currency).HasColumnName("total_currency");
        });

        builder.Property(i => i.Status)
            .HasConversion<string>();     // persist enum as text
    }
}
```

### Option B: Separate persistence model with `ToEntity` / `FromEntity`

When the schema and domain diverge (or you use Dapper), keep a persistence model and convert
explicitly. Rehydrate through `Reconstruct` (no re-validation of trusted data).

```csharp
// Infrastructure/Persistence/Models/InvoiceModel.cs
public sealed class InvoiceModel
{
    public Guid Id { get; init; }
    public Guid CustomerId { get; init; }
    public decimal TotalAmount { get; init; }
    public string TotalCurrency { get; init; } = "";
    public string Status { get; init; } = "";
    public DateTimeOffset CreatedAt { get; init; }

    public Invoice ToEntity() => Invoice.Reconstruct(
        new InvoiceId(Id),
        new CustomerId(CustomerId),
        Money.Create(TotalAmount, TotalCurrency).Value,   // trusted data
        Enum.Parse<InvoiceStatus>(Status),
        CreatedAt);

    public static InvoiceModel FromEntity(Invoice invoice) => new()
    {
        Id = invoice.Id.Value,
        CustomerId = invoice.CustomerId.Value,
        TotalAmount = invoice.Total.Amount,
        TotalCurrency = invoice.Total.Currency,
        Status = invoice.Status.ToString(),
        CreatedAt = invoice.CreatedAt
    };
}
```

### Why This Matters

| Benefit | Explanation |
|---------|-------------|
| Layer isolation | Domain knows nothing about tables or ORMs |
| Testability | Entities are testable without a database |
| Schema flexibility | The database can evolve without touching the domain |
| Type safety | Explicit conversions prevent accidental primitive mixing |

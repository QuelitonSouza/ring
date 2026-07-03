# C# Standards - Architecture

> **Module:** architecture.md | **Parent:** [index.md](index.md)

This module defines the architectural patterns for C# / ASP.NET Core services: Clean
Architecture, DDD layering, Hexagonal (Ports & Adapters), the dependency rule, directory
structure, dependency injection, and CQRS with MediatR.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Clean Architecture (MANDATORY)](#clean-architecture-mandatory) | Layer responsibilities |
| 2 | [The Dependency Rule (MANDATORY)](#the-dependency-rule-mandatory) | Which layer may reference which |
| 3 | [Hexagonal (Ports & Adapters)](#hexagonal-ports--adapters) | Ports defined by the core, adapters implement |
| 4 | [Directory Structure](#directory-structure) | Solution and folder layout |
| 5 | [Dependency Injection (MANDATORY)](#dependency-injection-mandatory) | Built-in container, lifetimes, module wiring |
| 6 | [CQRS with MediatR (CONDITIONAL)](#cqrs-with-mediatr-conditional) | Commands, queries, handlers, behaviors |

---

## Clean Architecture (MANDATORY)

All services MUST follow Clean Architecture with four layers. Business rules live at the center
and know nothing about frameworks, databases, or transport.

| Layer | Project | Responsibility | May Depend On |
|-------|---------|----------------|---------------|
| **Domain** | `YourService.Domain` | Entities, value objects, aggregates, domain events, domain errors, domain services | Nothing (no framework, no NuGet infra) |
| **Application** | `YourService.Application` | Use cases, ports (interfaces), DTOs, orchestration | Domain |
| **Infrastructure** | `YourService.Infrastructure` | EF Core, repositories, external HTTP/gRPC clients, message bus | Application, Domain |
| **API (Presentation)** | `YourService.Api` | Endpoints/controllers, middleware, DI wiring, `Program.cs` | Application, Infrastructure (composition root only), Domain |

```text
             +------------------+
             |       API        |  transport, HTTP, DI wiring
             +--------+---------+
                      |
        +-------------+-------------+
        |                           |
+-------v--------+         +--------v-------+
| Infrastructure |         |  Application   |  use cases, ports (interfaces)
|  (adapters)    +--------->                |
+-------+--------+         +--------+-------+
        |                           |
        +-------------+-------------+
                      |
              +-------v-------+
              |    Domain     |  entities, value objects, events (zero deps)
              +---------------+
```

---

## The Dependency Rule (MANDATORY)

Dependencies point **inward**. Nothing in an inner layer references an outer layer.

```text
Api            -> Application, Infrastructure (only at composition root), Domain
Infrastructure -> Application, Domain
Application    -> Domain
Domain         -> (nothing)
```

**Enforced rules:**

- `Domain` references **no** NuGet infrastructure packages (no EF Core, no ASP.NET, no Serilog).
- `Application` defines **ports** (interfaces) it needs; `Infrastructure` provides the **adapters**.
- Only `Api` (the composition root) is allowed to reference `Infrastructure` in order to register
  concrete implementations. Application code depends on abstractions only.
- Enforce boundaries with project references plus, optionally, an architecture test
  (e.g. `NetArchTest.Rules`) in CI.

```csharp
// Architecture test example (tests/YourService.ArchitectureTests)
[Fact]
public void Domain_Should_Not_Depend_On_Other_Layers()
{
    var result = Types.InAssembly(typeof(Invoice).Assembly)
        .Should()
        .NotHaveDependencyOnAny("YourService.Application",
                                "YourService.Infrastructure",
                                "YourService.Api")
        .GetResult();

    result.IsSuccessful.Should().BeTrue();
}
```

---

## Hexagonal (Ports & Adapters)

Clean Architecture and Hexagonal are complementary: the port is an interface **owned by the core
(Application)**; the adapter is the implementation in Infrastructure.

```csharp
// Application/Ports/IInvoiceRepository.cs  (PORT — defined where it is USED)
namespace YourService.Application.Ports;

public interface IInvoiceRepository
{
    Task<Invoice?> GetByIdAsync(InvoiceId id, CancellationToken cancellationToken);
    Task AddAsync(Invoice invoice, CancellationToken cancellationToken);
}
```

```csharp
// Infrastructure/Persistence/InvoiceRepository.cs  (ADAPTER — implements the port)
namespace YourService.Infrastructure.Persistence;

public sealed class InvoiceRepository : IInvoiceRepository
{
    private readonly AppDbContext _db;

    public InvoiceRepository(AppDbContext db) => _db = db;

    public async Task<Invoice?> GetByIdAsync(InvoiceId id, CancellationToken cancellationToken)
        => await _db.Invoices.FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

    public async Task AddAsync(Invoice invoice, CancellationToken cancellationToken)
        => await _db.Invoices.AddAsync(invoice, cancellationToken);
}
```

**Driving side** (inbound): API endpoints/controllers call Application use cases.
**Driven side** (outbound): Application calls ports; Infrastructure adapters fulfill them
(databases, queues, third-party HTTP).

---

## Directory Structure

```text
/src
  /YourService.Domain
    /Invoices
      Invoice.cs                  # aggregate root (entity)
      InvoiceId.cs                # strongly-typed id (readonly record struct)
      InvoiceStatus.cs            # enum / smart enum
      Money.cs                    # value object
      InvoicePaidEvent.cs         # domain event
    /Common
      Entity.cs                   # base entity / aggregate root
      ValueObject.cs
      Result.cs                   # Result<TValue, TError>
    /Errors
      DomainError.cs
      ErrorCodes.cs

  /YourService.Application
    /Invoices
      /Commands
        CreateInvoice/            # command + handler + validator (CQRS)
      /Queries
        GetInvoiceById/
      /Dtos
        InvoiceResponse.cs
    /Ports
      IInvoiceRepository.cs
      IUnitOfWork.cs
      IClock.cs
    DependencyInjection.cs        # AddApplication()

  /YourService.Infrastructure
    /Persistence
      AppDbContext.cs
      /Configurations             # EF Core IEntityTypeConfiguration<T>
      InvoiceRepository.cs        # adapters
      UnitOfWork.cs
    /External
      PaymentGatewayClient.cs
    DependencyInjection.cs        # AddInfrastructure()

  /YourService.Api
    /Endpoints                    # Minimal API endpoint groups
      InvoiceEndpoints.cs
    /Controllers                  # (if using Controllers instead)
    /Middleware
      ExceptionHandlingMiddleware.cs
    Program.cs

/tests
  /YourService.Domain.Tests
  /YourService.Application.Tests
  /YourService.Api.IntegrationTests
  /YourService.ArchitectureTests
```

---

## Dependency Injection (MANDATORY)

Use the built-in `Microsoft.Extensions.DependencyInjection` container. Third-party containers
(Autofac, etc.) are not required and MUST NOT be introduced without an explicit `PROJECT_RULES.md`
decision. The **Service Locator** anti-pattern (injecting `IServiceProvider` to resolve services
on demand) is **FORBIDDEN**.

### Register per Layer with Extension Methods

```csharp
// Application/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddScoped<ICreateInvoiceHandler, CreateInvoiceHandler>();
        // or: services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(...).Assembly));
        return services;
    }
}
```

```csharp
// Infrastructure/DependencyInjection.cs
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<AppDbContext>(options =>
            options.UseNpgsql(configuration.GetConnectionString("Primary")));

        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddSingleton<IClock, SystemClock>();
        return services;
    }
}
```

```csharp
// Api/Program.cs (composition root — the ONLY place that wires layers together)
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
```

### Service Lifetimes

| Lifetime | Use For | Caution |
|----------|---------|---------|
| `Singleton` | Stateless, thread-safe services; clocks; caches | Never capture a scoped service inside a singleton |
| `Scoped` | Per-request services: `DbContext`, repositories, use-case handlers | Default for most application/infra services |
| `Transient` | Lightweight, stateless helpers created on demand | Avoid for expensive-to-construct objects |

**Rules:**
- Constructor injection only. No property/setter injection, no Service Locator.
- Depend on abstractions (ports), not concrete Infrastructure types, in Application code.
- Do not resolve services manually via `IServiceProvider.GetService` outside framework
  integration points (e.g. background service scope creation).

```csharp
// FORBIDDEN: Service Locator
public sealed class InvoiceService
{
    private readonly IServiceProvider _provider;                 // NEVER
    public void Do() => _provider.GetService<IInvoiceRepository>();
}

// CORRECT: constructor injection of the abstraction
public sealed class InvoiceService(IInvoiceRepository repository) { ... }
```

---

## CQRS with MediatR (CONDITIONAL)

Apply CQRS when read and write models diverge or when a service accumulates many use cases.
For simple CRUD, a plain application service is acceptable — do not add MediatR reflexively.

### Command (Write)

```csharp
// Application/Invoices/Commands/CreateInvoice/CreateInvoiceCommand.cs
public sealed record CreateInvoiceCommand(string CustomerId, decimal Amount, string Currency)
    : IRequest<Result<InvoiceResponse, DomainError>>;
```

```csharp
// CreateInvoiceHandler.cs
public sealed class CreateInvoiceHandler(
    IInvoiceRepository repository,
    IUnitOfWork unitOfWork,
    ILogger<CreateInvoiceHandler> logger)
    : IRequestHandler<CreateInvoiceCommand, Result<InvoiceResponse, DomainError>>
{
    private static readonly ActivitySource ActivitySource = new("YourService.Application");

    public async Task<Result<InvoiceResponse, DomainError>> Handle(
        CreateInvoiceCommand command, CancellationToken cancellationToken)
    {
        using var activity = ActivitySource.StartActivity("handler.invoice.create");
        logger.LogInformation("Creating invoice for customer {CustomerId}", command.CustomerId);

        var money = Money.Create(command.Amount, command.Currency);
        if (money.IsFailure)
        {
            activity?.AddEvent(new ActivityEvent("validation_failed"));
            return money.Error;
        }

        var invoice = Invoice.Create(new CustomerId(command.CustomerId), money.Value);
        if (invoice.IsFailure)
        {
            activity?.AddEvent(new ActivityEvent("validation_failed"));
            return invoice.Error;
        }

        await repository.AddAsync(invoice.Value, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        logger.LogInformation("Invoice {InvoiceId} created", invoice.Value.Id);
        return InvoiceResponse.FromEntity(invoice.Value);
    }
}
```

### Query (Read)

Queries bypass the write model and may project straight from the database for efficiency.

```csharp
public sealed record GetInvoiceByIdQuery(Guid Id) : IRequest<Result<InvoiceResponse, DomainError>>;

public sealed class GetInvoiceByIdHandler(AppDbContext db)
    : IRequestHandler<GetInvoiceByIdQuery, Result<InvoiceResponse, DomainError>>
{
    public async Task<Result<InvoiceResponse, DomainError>> Handle(
        GetInvoiceByIdQuery query, CancellationToken cancellationToken)
    {
        var response = await db.Invoices
            .AsNoTracking()
            .Where(i => i.Id == new InvoiceId(query.Id))
            .Select(i => InvoiceResponse.FromEntity(i))
            .FirstOrDefaultAsync(cancellationToken);

        return response is null
            ? DomainError.NotFound("Invoice", query.Id)
            : response;
    }
}
```

### Cross-Cutting Behaviors (Pipeline)

Use MediatR `IPipelineBehavior<,>` for concerns that wrap every request — validation, logging,
transactions — instead of repeating them in each handler.

```csharp
// Application/Behaviors/ValidationBehavior.cs
public sealed class ValidationBehavior<TRequest, TResponse>(IEnumerable<IValidator<TRequest>> validators)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        var context = new ValidationContext<TRequest>(request);
        var failures = validators
            .Select(v => v.Validate(context))
            .SelectMany(r => r.Errors)
            .Where(f => f is not null)
            .ToList();

        if (failures.Count != 0)
            throw new ValidationException(failures);

        return await next();
    }
}
```

```csharp
// Registration (Application/DependencyInjection.cs)
services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));
services.AddValidatorsFromAssembly(typeof(DependencyInjection).Assembly);
services.AddScoped(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
```

> **When NOT to use MediatR:** thin CRUD services, prototypes, or a single-use-case worker.
> A directly-injected application service is simpler and equally valid there.

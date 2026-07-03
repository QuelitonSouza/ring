# C# Standards - API Patterns

> **Module:** api-patterns.md | **Parent:** [index.md](index.md)

This module defines HTTP API conventions for ASP.NET Core: Minimal APIs and Controllers, JSON
naming, `ProblemDetails` (RFC 7807), status-code consistency, API versioning, model binding &
validation, and pagination.

> **Reference**: Always consult `docs/PROJECT_RULES.md` for common project standards.
> Depends on [domain.md](domain.md) for error codes and the `Result<T>` pattern.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Minimal APIs vs Controllers](#minimal-apis-vs-controllers) | When to use each |
| 2 | [JSON Naming Convention (camelCase) (MANDATORY)](#json-naming-convention-camelcase-mandatory) | Serialization rules |
| 3 | [ProblemDetails / RFC 7807 (MANDATORY)](#problemdetails--rfc-7807-mandatory) | Standard error responses |
| 4 | [HTTP Status Code Consistency (MANDATORY)](#http-status-code-consistency-mandatory) | Correct codes per verb |
| 5 | [API Versioning (MANDATORY)](#api-versioning-mandatory) | URL-segment versioning |
| 6 | [Model Binding & Validation](#model-binding--validation) | Input parsing and validation |
| 7 | [Pagination Patterns](#pagination-patterns) | Page-based and cursor-based |
| 8 | [OpenAPI Documentation](#openapi-documentation) | Swagger/OpenAPI generation |

---

## Minimal APIs vs Controllers

Both are first-class in ASP.NET Core. Pick one style per service and stay consistent.

| Approach | Use Case |
|----------|----------|
| **Minimal APIs** | Lightweight services, microservices, focused endpoint sets |
| **Controllers (MVC)** | Large surface areas, complex routing/filters, teams standardized on MVC |
| **gRPC** | High-throughput service-to-service communication |

### Minimal API Endpoint Group

Organize Minimal APIs into endpoint-group extension methods — never inline dozens of routes in
`Program.cs`.

```csharp
// Api/Endpoints/InvoiceEndpoints.cs
public static class InvoiceEndpoints
{
    public static IEndpointRouteBuilder MapInvoiceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/v1/invoices").WithTags("Invoices");

        group.MapGet("/{id:guid}", GetById).WithName(nameof(GetById));
        group.MapPost("/", Create);

        return app;
    }

    private static async Task<IResult> GetById(
        Guid id, ISender sender, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetInvoiceByIdQuery(id), cancellationToken);
        return result.Match(
            success => Results.Ok(success),
            error => error.ToProblemResult());
    }

    private static async Task<IResult> Create(
        CreateInvoiceRequest request, ISender sender, CancellationToken cancellationToken)
    {
        var result = await sender.Send(request.ToCommand(), cancellationToken);
        return result.Match(
            success => Results.Created($"/v1/invoices/{success.Id}", success),
            error => error.ToProblemResult());
    }
}
```

```csharp
// Program.cs
app.MapInvoiceEndpoints();
```

### Controller Equivalent

```csharp
[ApiController]
[Route("v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
public sealed class InvoicesController(ISender sender) : ControllerBase
{
    [HttpGet("{id:guid}")]
    [ProducesResponseType<InvoiceResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetInvoiceByIdQuery(id), cancellationToken);
        return result.Match<IActionResult>(
            success => Ok(success),
            error => error.ToActionResult());
    }

    [HttpPost]
    [ProducesResponseType<InvoiceResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        CreateInvoiceRequest request, CancellationToken cancellationToken)
    {
        var result = await sender.Send(request.ToCommand(), cancellationToken);
        return result.Match<IActionResult>(
            success => CreatedAtAction(nameof(GetById), new { id = success.Id }, success),
            error => error.ToActionResult());
    }
}
```

---

## JSON Naming Convention (camelCase) (MANDATORY)

All JSON request and response bodies MUST use **camelCase** property names. Configure the
serializer globally so DTOs are written in PascalCase in C# and emitted in camelCase over the wire.

```csharp
// Program.cs — Minimal APIs
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

// Program.cs — Controllers
builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});
```

| Rule | Detail |
|------|--------|
| Use `System.Text.Json` | Default serializer; do not add Newtonsoft without a `PROJECT_RULES.md` reason |
| camelCase properties | `totalAmount`, `createdAt` — never `TotalAmount` or `total_amount` on the wire |
| Enums as strings | Register `JsonStringEnumConverter`; never expose integer enum values |
| Nullable honesty | Omit null values (`WhenWritingNull`) or represent them explicitly and consistently |

```csharp
// CORRECT: C# PascalCase properties, camelCase on the wire via the global policy
public sealed record InvoiceResponse(Guid Id, decimal TotalAmount, string Currency, DateTimeOffset CreatedAt);
// → { "id": "...", "totalAmount": 100.0, "currency": "BRL", "createdAt": "..." }
```

---

## ProblemDetails / RFC 7807 (MANDATORY)

All error responses MUST use the `application/problem+json` media type per **RFC 7807**
(`ProblemDetails`). Ad-hoc error shapes (`{ "error": "..." }`) are **FORBIDDEN**.

### Register ProblemDetails and an Exception Handler

```csharp
// Program.cs
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = ctx =>
    {
        ctx.ProblemDetails.Instance = ctx.HttpContext.Request.Path;
        ctx.ProblemDetails.Extensions["traceId"] = Activity.Current?.Id
            ?? ctx.HttpContext.TraceIdentifier;
    };
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

var app = builder.Build();
app.UseExceptionHandler();   // converts unhandled exceptions into ProblemDetails
app.UseStatusCodePages();
```

### Map Domain Errors to ProblemDetails

Translate the domain `Result<T>` error (see [domain.md](domain.md)) into a typed problem response.
Keep this mapping in the API layer so the domain stays transport-agnostic.

```csharp
// Api/Extensions/DomainErrorExtensions.cs
public static class DomainErrorExtensions
{
    public static IResult ToProblemResult(this DomainError error) =>
        Results.Problem(
            statusCode: error.StatusCode,
            title: error.Code,
            detail: error.Message,
            type: $"https://errors.example.com/{error.Code}",
            extensions: new Dictionary<string, object?> { ["errorCode"] = error.Code });

    public static IActionResult ToActionResult(this DomainError error) =>
        new ObjectResult(new ProblemDetails
        {
            Status = error.StatusCode,
            Title = error.Code,
            Detail = error.Message,
            Type = $"https://errors.example.com/{error.Code}",
            Extensions = { ["errorCode"] = error.Code }
        }) { StatusCode = error.StatusCode };
}
```

### Global Exception Handler (Unexpected Errors)

```csharp
// Api/GlobalExceptionHandler.cs
public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        logger.LogError(exception, "Unhandled exception for {Path}", httpContext.Request.Path);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "An unexpected error occurred.",
            Type = "https://errors.example.com/internal",
        };

        httpContext.Response.StatusCode = problem.Status.Value;
        await httpContext.Response.WriteAsJsonAsync(problem, cancellationToken);
        return true;
    }
}
```

**Rules:**
- Never leak stack traces or internal messages in `detail` for 5xx responses.
- Include a correlation `traceId` extension on every problem for support/debugging.
- Validation failures return `400` with a `ValidationProblemDetails` (`errors` dictionary).

---

## HTTP Status Code Consistency (MANDATORY)

| Verb / Outcome | Status | Notes |
|----------------|--------|-------|
| Successful `GET` | `200 OK` | Body = resource(s) |
| Successful `POST` (created) | `201 Created` | `Location` header to the new resource |
| Successful `POST` (action, no resource) | `200 OK` / `202 Accepted` | `202` for async processing |
| Successful `PUT`/`PATCH` | `200 OK` | `204 No Content` if nothing returned |
| Successful `DELETE` | `204 No Content` | Empty body |
| Validation failure | `400 Bad Request` | `ValidationProblemDetails` |
| Unauthenticated | `401 Unauthorized` | Missing/invalid credentials |
| Unauthorized | `403 Forbidden` | Authenticated but not allowed |
| Not found | `404 Not Found` | ProblemDetails |
| Conflict / duplicate | `409 Conflict` | ProblemDetails |
| Unprocessable domain rule | `422 Unprocessable Entity` | ProblemDetails |
| Server error | `500 Internal Server Error` | ProblemDetails, no internals leaked |

### FORBIDDEN

```csharp
// FORBIDDEN: 200 OK for a creation
return Results.Ok(created);              // POST that creates a resource → use 201

// FORBIDDEN: returning 200 with an error body
return Results.Ok(new { error = "not found" });   // use Results.Problem(404)
```

---

## API Versioning (MANDATORY)

Every public API MUST be versioned from day one. Use **URL-segment** versioning (`/v1/...`) as the
default; it is explicit and cache-friendly.

```csharp
// Program.cs (using Asp.Versioning.Http / Asp.Versioning.Mvc)
builder.Services
    .AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
        options.ApiVersionReader = new UrlSegmentApiVersionReader();
    })
    .AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";
        options.SubstituteApiVersionInUrl = true;
    });
```

```csharp
// Minimal API version set
var versionSet = app.NewApiVersionSet().HasApiVersion(new ApiVersion(1, 0)).Build();
app.MapGroup("/v{version:apiVersion}/invoices")
   .WithApiVersionSet(versionSet)
   .MapInvoiceEndpoints();
```

**Rules:**
- Never break an existing version. Introduce `/v2` for breaking changes and keep `/v1` until
  clients migrate.
- Version the URL, not just the payload. Header-only versioning is discouraged for public APIs.

---

## Model Binding & Validation

Validate all inbound requests. Prefer a validation library (FluentValidation) or data annotations
plus a MediatR validation behavior (see [architecture.md](architecture.md#cross-cutting-behaviors-pipeline)).
Deep invariants belong in the domain (see [domain.md](domain.md#always-valid-domain-model-mandatory)),
not in the controller.

### Request DTOs Are Immutable Records

```csharp
public sealed record CreateInvoiceRequest(string CustomerId, decimal Amount, string Currency)
{
    public CreateInvoiceCommand ToCommand() => new(CustomerId, Amount, Currency);
}
```

### FluentValidation

```csharp
public sealed class CreateInvoiceRequestValidator : AbstractValidator<CreateInvoiceRequest>
{
    public CreateInvoiceRequestValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Currency).NotEmpty().Length(3);
    }
}
```

### Returning Validation Errors as ProblemDetails

```csharp
// Minimal API filter turning validation failures into 400 ValidationProblemDetails
group.MapPost("/", Create).AddEndpointFilter<ValidationFilter<CreateInvoiceRequest>>();

// On failure:
return Results.ValidationProblem(errors); // { "errors": { "amount": ["must be > 0"] } }
```

**Rules:**
- Bind route/query/body explicitly; avoid overposting by using dedicated request DTOs, never
  binding directly to domain entities.
- Validate at the edge for shape (required, ranges, formats); enforce business invariants in the
  domain model.
- Route constraints (`{id:guid}`) reject malformed input before the handler runs.

---

## Pagination Patterns

| Pattern | Best For | Query Params | Response Fields |
|---------|----------|--------------|-----------------|
| **Page-based** | UI navigation, low/medium volume | `page`, `pageSize`, `sortOrder` | `page`, `pageSize`, `totalCount` (optional) |
| **Cursor-based** | High-volume, real-time, infinite scroll | `cursor`, `limit`, `sortOrder` | `nextCursor`, `prevCursor` |

Cap `pageSize`/`limit` with a hard maximum (e.g. 100) to protect the database.

### Page-Based (EF Core)

```csharp
public async Task<PagedResult<InvoiceResponse>> GetPageAsync(
    PageRequest request, CancellationToken cancellationToken)
{
    var pageSize = Math.Clamp(request.PageSize, 1, 100);
    var query = _db.Invoices.AsNoTracking();

    query = request.SortOrder == "desc"
        ? query.OrderByDescending(i => i.CreatedAt)
        : query.OrderBy(i => i.CreatedAt);

    var items = await query
        .Skip((request.Page - 1) * pageSize)
        .Take(pageSize)
        .Select(i => InvoiceResponse.FromEntity(i))
        .ToListAsync(cancellationToken);

    return new PagedResult<InvoiceResponse>(items, request.Page, pageSize);
}
```

### Cursor-Based (EF Core)

```csharp
public async Task<CursorPagedResult<InvoiceResponse>> GetCursorAsync(
    CursorRequest request, CancellationToken cancellationToken)
{
    var limit = Math.Clamp(request.Limit, 1, 100);
    var query = _db.Invoices.AsNoTracking();

    if (!string.IsNullOrEmpty(request.Cursor))
    {
        var cursor = CursorCodec.Decode(request.Cursor);
        query = query.Where(i =>
            i.CreatedAt > cursor.CreatedAt ||
            (i.CreatedAt == cursor.CreatedAt && i.Id.Value.CompareTo(cursor.Id) > 0));
    }

    var items = await query
        .OrderBy(i => i.CreatedAt).ThenBy(i => i.Id)
        .Take(limit + 1)                         // fetch one extra to detect "has more"
        .ToListAsync(cancellationToken);

    var hasMore = items.Count > limit;
    if (hasMore) items.RemoveAt(items.Count - 1);

    return new CursorPagedResult<InvoiceResponse>(
        items.Select(InvoiceResponse.FromEntity).ToList(),
        NextCursor: hasMore ? CursorCodec.Encode(items[^1]) : null);
}
```

**Rules:**
- Cursor pagination requires a stable, unique sort key (timestamp + tiebreaker id).
- Return `totalCount` only when the UI needs "Page X of Y"; it costs an extra `COUNT(*)`.
- Never trust client-supplied `limit` without clamping.

---

## OpenAPI Documentation

- Generate OpenAPI from code (`Microsoft.AspNetCore.OpenApi` on .NET 9, or Swashbuckle/NSwag).
  Do not hand-edit generated specs.
- Annotate responses with `[ProducesResponseType<T>(...)]` (Controllers) or `.Produces<T>(...)`
  (Minimal APIs) so the spec lists every status code, including the `ProblemDetails` failures.
- Group and tag endpoints (`.WithTags(...)`) and give operations stable names (`.WithName(...)`).

```csharp
group.MapPost("/", Create)
    .Produces<InvoiceResponse>(StatusCodes.Status201Created)
    .ProducesProblem(StatusCodes.Status400BadRequest)
    .ProducesProblem(StatusCodes.Status409Conflict)
    .WithSummary("Create an invoice");
```

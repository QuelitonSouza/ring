# C# Standards - Integration Testing

> **Module:** testing-integration.md | **Sections:** 10 | **Parent:** [index.md](index.md)

This module covers integration testing for C# / ASP.NET Core projects using
**`WebApplicationFactory`** for the HTTP boundary and **Testcontainers for .NET** for real external
dependencies (PostgreSQL, SQL Server, Redis, MongoDB, RabbitMQ). Integration tests verify that
components work correctly against **real** infrastructure, not mocks.

> **Gate Reference:** This module is available to backend engineers during Gate 0 quality
> verification when integration testing is required. Ring standards are the baseline; `docs/PROJECT_RULES.md`
> may add project-specific rules but must not weaken the requirements defined here.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Test Pyramid](#test-pyramid) | Unit > Integration > E2E ratio |
| 2 | [Project & Naming Convention](#project--naming-convention-mandatory) | `*.IntegrationTests`, `[Trait]`, function names |
| 3 | [WebApplicationFactory](#webapplicationfactory-mandatory) | In-process HTTP boundary tests |
| 4 | [Testcontainers for .NET](#testcontainers-for-net-mandatory) | Real DB / cache / broker lifecycle |
| 5 | [Shared Fixtures & Collections](#shared-fixtures--collections-mandatory) | `IAsyncLifetime`, `ICollectionFixture` |
| 6 | [Test Isolation](#test-isolation-mandatory) | Respawn / per-test data, no shared state |
| 7 | [Fixture Centralization](#fixture-centralization-mandatory) | Shared builders, no local `CreateTest*` |
| 8 | [Guardrails (Anti-Patterns)](#guardrails-anti-patterns-mandatory) | What not to do |
| 9 | [Test Failure Analysis](#test-failure-analysis-no-greenwashing) | Root-cause, no greenwashing |
| 10 | [Integration Test Quality Gate](#integration-test-quality-gate-mandatory) | Checklist before completion |

**Meta-sections:** [Output Format](#output-format-gate-0---integration-testing) | [Anti-Rationalization Table](#anti-rationalization-table-integration-testing)

---

## Test Pyramid

### Principle: Unit > Integration > E2E

| Level | Scope | Speed | Coverage Focus | Typical Ratio |
|-------|-------|-------|----------------|---------------|
| **Unit** | Single class/method | Fast (ms) | Business logic, edge cases | 70% |
| **Integration** | Multiple components + real I/O | Medium (s) | Database, APIs, brokers | 20% |
| **E2E** | Full system | Slow (min) | Critical user journeys | 10% |

**Default to unit tests.** Integration tests exist to verify that boundaries work correctly.

### When Integration Tests Are Warranted

| Code Type | Integration Test Needed | What to Test |
|-----------|-------------------------|--------------|
| Repository / EF Core `DbContext` / Dapper | Touches a real DB | CRUD, query correctness, constraints, migrations |
| API endpoint (controller / Minimal API) | Full pipeline via `WebApplicationFactory` | Routing, model binding, auth, ProblemDetails, status codes |
| Indexes / constraints | Unique indexes, filtered indexes, FKs | Constraint violations surface as expected errors |
| Message consumers (MassTransit / RabbitMQ) | Publish → consume round-trip | Delivery, retry, dead-letter behavior |
| Caching (Redis / Valkey) | Read-through / write-through | TTL, invalidation, serialization round-trip |
| Transactions | Multi-step DB operations | Rollback, isolation level behavior |

### When Integration Tests Are NOT Needed

| Code Type | Unit Test Sufficient | Reason |
|-----------|----------------------|--------|
| Pure functions | Validators, mappers, calculators | No I/O, deterministic |
| Use-case orchestration | With mocked repositories | Logic testable in isolation |
| DTO ↔ entity mapping | AutoMapper profiles / manual mappers | No external dependency |

---

## Project & Naming Convention (MANDATORY)

**HARD GATE:** Integration tests live in a **separate test project** and are **traited** so they can
be excluded from the fast unit run.

| Test Type | Project | Trait / Filter |
|-----------|---------|----------------|
| Unit | `YourService.UnitTests` | none |
| Integration | `YourService.IntegrationTests` | `[Trait("Category", "Integration")]` |

### Function Naming

```text
{Component}_{Scenario}_{ExpectedResult}

Examples:
- CreateUser_WithValidPayload_Returns201Created
- GetUser_WithUnknownId_Returns404NotFound
- UserRepository_Insert_PersistsRow
- OrderConsumer_OnOrderPlaced_WritesProjection
```

### Trait for Selective Runs

```csharp
[Trait("Category", "Integration")]
public class UserApiTests : IClassFixture<ApiFactory>
{
    // ...
}
```

```bash
# Fast unit run — exclude integration
dotnet test --filter "Category!=Integration"

# Integration only (requires Docker running)
dotnet test --filter "Category=Integration"

# Everything
dotnet test
```

---

## WebApplicationFactory (MANDATORY)

**HARD GATE:** HTTP-boundary integration tests MUST use `WebApplicationFactory<TEntryPoint>`
(from `Microsoft.AspNetCore.Mvc.Testing`) to host the app **in-process**. Do not start a real
Kestrel server on a fixed port, and do not hit a deployed environment.

### Package

```xml
<PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.*" />
```

> `TEntryPoint` is your app's `Program` class. With top-level statements, expose it by adding
> `public partial class Program;` at the bottom of `Program.cs`.

### Custom Factory (swap real infra for containers)

```csharp
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureTestServices(services =>
        {
            // Replace the real connection string with the container's
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(o =>
                o.UseNpgsql(_postgres.GetConnectionString()));
        });
    }

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        // Apply migrations against the fresh container
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }

    public new async Task DisposeAsync() => await _postgres.DisposeAsync();
}
```

### Test Using the Factory

```csharp
[Trait("Category", "Integration")]
public class UserApiTests : IClassFixture<ApiFactory>
{
    private readonly HttpClient _client;

    public UserApiTests(ApiFactory factory) => _client = factory.CreateClient();

    [Fact]
    public async Task CreateUser_WithValidPayload_Returns201Created()
    {
        // Arrange
        var payload = new { name = "John", email = "john@example.com" };

        // Act
        var response = await _client.PostAsJsonAsync("/api/v1/users", payload);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var body = await response.Content.ReadFromJsonAsync<UserResponse>();
        body!.Name.Should().Be("John");
        response.Headers.Location.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUser_WithUnknownId_Returns404WithProblemDetails()
    {
        var response = await _client.GetAsync($"/api/v1/users/{Guid.NewGuid()}");

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>();
        problem!.Status.Should().Be(404);
    }
}
```

---

## Testcontainers for .NET (MANDATORY)

**HARD GATE:** Integration tests MUST provision external dependencies with **Testcontainers for
.NET**. A shared docker-compose on fixed ports, or pointing at a real shared database, is FORBIDDEN.

### Packages

| Dependency | Package |
|------------|---------|
| PostgreSQL | `Testcontainers.PostgreSql` |
| SQL Server | `Testcontainers.MsSql` |
| Redis / Valkey | `Testcontainers.Redis` |
| MongoDB | `Testcontainers.MongoDb` |
| RabbitMQ | `Testcontainers.RabbitMq` |

### PostgreSQL

```csharp
var postgres = new PostgreSqlBuilder()
    .WithImage("postgres:16-alpine")
    .WithDatabase("test_db")
    .WithUsername("test")
    .WithPassword("test")
    .Build();

await postgres.StartAsync();
var connectionString = postgres.GetConnectionString(); // dynamic port — no conflicts
// ... run test ...
await postgres.DisposeAsync();
```

### SQL Server

```csharp
var sql = new MsSqlBuilder()
    .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
    .Build();
await sql.StartAsync();
var connectionString = sql.GetConnectionString();
```

### Redis

```csharp
var redis = new RedisBuilder().WithImage("redis:7-alpine").Build();
await redis.StartAsync();
var multiplexer = await ConnectionMultiplexer.ConnectAsync(redis.GetConnectionString());
```

### Repository Test (real DB, no HTTP)

```csharp
[Trait("Category", "Integration")]
public class UserRepositoryTests : IClassFixture<PostgresFixture>
{
    private readonly PostgresFixture _fixture;

    public UserRepositoryTests(PostgresFixture fixture) => _fixture = fixture;

    [Fact]
    public async Task Insert_ThenGetById_ReturnsPersistedUser()
    {
        // Arrange
        await using var context = _fixture.CreateContext();
        var repository = new UserRepository(context);
        var user = UserBuilder.Valid().WithName("John").Build();

        // Act
        await repository.CreateAsync(user, CancellationToken.None);
        var loaded = await repository.GetByIdAsync(user.Id, CancellationToken.None);

        // Assert
        loaded.Should().NotBeNull();
        loaded!.Name.Should().Be("John");
    }

    [Fact]
    public async Task Insert_WithDuplicateEmail_ThrowsUniqueViolation()
    {
        await using var context = _fixture.CreateContext();
        var repository = new UserRepository(context);
        await repository.CreateAsync(UserBuilder.Valid().WithEmail("dup@x.com").Build(), default);

        var act = async () =>
            await repository.CreateAsync(UserBuilder.Valid().WithEmail("dup@x.com").Build(), default);

        await act.Should().ThrowAsync<DbUpdateException>();
    }
}
```

### Why Testcontainers Over docker-compose

| Concern | docker-compose | Testcontainers |
|---------|----------------|----------------|
| Ports | Fixed (`:5432` conflicts) | Dynamic (no conflicts) |
| Lifecycle | Manual up/down | Automatic per fixture |
| Cleanup | Manual | Automatic via `IAsyncLifetime.DisposeAsync` + Ryuk |
| CI | Requires compose orchestration | Just needs a Docker daemon |
| Isolation | Shared instance | Fresh instance per run |

---

## Shared Fixtures & Collections (MANDATORY)

**HARD GATE:** Container startup is expensive. Start it **once per class** (`IClassFixture`) or
**once per collection** (`ICollectionFixture`) — never once per test method. Fixtures MUST implement
`IAsyncLifetime` so startup/teardown is async and awaited.

### Async Fixture

```csharp
public sealed class PostgresFixture : IAsyncLifetime
{
    private readonly PostgreSqlContainer _container = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .Build();

    public string ConnectionString => _container.GetConnectionString();

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        await using var ctx = CreateContext();
        await ctx.Database.MigrateAsync();
    }

    public AppDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString).Options);

    public async Task DisposeAsync() => await _container.DisposeAsync();
}
```

### Collection (share ONE container across many test classes)

```csharp
[CollectionDefinition("Postgres")]
public sealed class PostgresCollection : ICollectionFixture<PostgresFixture>;

[Collection("Postgres")]
[Trait("Category", "Integration")]
public class UserRepositoryTests
{
    private readonly PostgresFixture _fixture;
    public UserRepositoryTests(PostgresFixture fixture) => _fixture = fixture;
    // ...
}
```

> **Parallelism note:** xUnit runs test *collections* in parallel but classes **within a collection**
> serially. Because integration tests share container state, group DB-touching classes into one
> collection (serialized) OR give each class its own fixture and rely on [test isolation](#test-isolation-mandatory).
> Do not enable class-level parallelism against a single shared database.

---

## Test Isolation (MANDATORY)

**HARD GATE:** Each test MUST NOT depend on data created by another test. A test's result must not
change based on execution order.

### Strategies (pick one, be consistent)

| Strategy | How | Best For |
|----------|-----|----------|
| **Unique data per test** | Generate `Guid` keys / random names per test | Most cases |
| **Reset between tests** | `Respawn` to truncate tables in `IAsyncLifetime` | Suites needing a clean slate |
| **Transaction rollback** | Wrap each test in a transaction, never commit | EF Core repo tests |

### Respawn Example

```csharp
public sealed class PostgresFixture : IAsyncLifetime
{
    private Respawner _respawner = default!;
    private NpgsqlConnection _connection = default!;

    public async Task InitializeAsync()
    {
        await _container.StartAsync();
        _connection = new NpgsqlConnection(ConnectionString);
        await _connection.OpenAsync();
        _respawner = await Respawner.CreateAsync(_connection, new RespawnerOptions
        {
            DbAdapter = DbAdapter.Postgres,
            TablesToIgnore = ["__EFMigrationsHistory"]
        });
    }

    public Task ResetAsync() => _respawner.ResetAsync(_connection);
}
```

Call `await _fixture.ResetAsync();` at the start of each test (or via `IAsyncLifetime` on the class).

---

## Fixture Centralization (MANDATORY)

**HARD GATE:** Entity builders and seed helpers MUST be centralized (e.g. a `TestSupport/` folder or
a shared `YourService.TestSupport` project). Local `CreateTestUser(...)` helpers copy-pasted into
each test file are FORBIDDEN.

### Builder Pattern (preferred)

```csharp
// TestSupport/Builders/UserBuilder.cs
public sealed class UserBuilder
{
    private string _name = "Test User";
    private string _email = $"user-{Guid.NewGuid():N}@example.com";

    public static UserBuilder Valid() => new();
    public UserBuilder WithName(string name) { _name = name; return this; }
    public UserBuilder WithEmail(string email) { _email = email; return this; }

    public User Build() => User.Create(_name, new Email(_email)).Value;
}
```

### FORBIDDEN

```csharp
// FORBIDDEN: local helper duplicated across test files
private static User CreateTestUser(string name) =>
    User.Create(name, new Email("x@y.com")).Value;
```

---

## Guardrails (Anti-Patterns) (MANDATORY)

**HARD GATE:** Before completing any integration test, verify NONE of these exist.

| # | Anti-Pattern | Impact | Fix |
|---|--------------|--------|-----|
| 1 | **Hardcoded ports** (`:5432`, `:6379`) | CI port conflicts | Use Testcontainers dynamic ports (`GetConnectionString()`) |
| 2 | **Shared / ordered test data** | Flaky, order-dependent | Unique data per test or Respawn reset |
| 3 | **`Task.Delay` for sync** | Slow, unreliable | Use container wait strategies / `WaitUntil` |
| 4 | **Real / shared environment** | Data corruption, secrets leak | Testcontainers only |
| 5 | **Container per test method** | Minutes-long suites | `IClassFixture` / `ICollectionFixture` |
| 6 | **Missing `[Trait]`** | Integration runs in the fast unit gate | Add `[Trait("Category","Integration")]` |
| 7 | **Class-level parallelism on shared DB** | Races, flaky failures | One collection (serialized) or per-class fixture + isolation |
| 8 | **Local fixtures** (`CreateTest*` per file) | Duplication, drift | Centralize in `TestSupport` |
| 9 | **No timeout** | Hanging tests | Pass a `CancellationToken` with timeout |
| 10 | **Sync-over-async** (`.Result`, `.Wait()`) | Deadlocks | `await` everything; `async Task` |
| 11 | **Production credentials in tests** | Security risk | Container-generated test credentials only |

### Detection

```bash
# Fixed ports in integration project
grep -rniE ":5432|:6379|:27017|:1433|:5672" YourService.IntegrationTests

# Sync-over-async
grep -rnE "\.Result|\.Wait\(\)" YourService.IntegrationTests --include=*.cs

# Task.Delay used as a sync hack
grep -rn "Task.Delay" YourService.IntegrationTests --include=*.cs
```

---

## Test Failure Analysis (No Greenwashing)

**HARD GATE:** Never weaken a test to make it pass.

### Decision Tree

```text
Test failed -> Is the assertion correct?
              |
              +-- NO (test bug) -----> Fix the test, document why
              |
              +-- YES -> Is the app behavior correct?
                         |
                         +-- YES (wrong expectation) -> Fix the test
                         +-- NO  (app bug) -----------> Keep test RED, report the bug
```

### Bug Report Format (when keeping a test RED)

```markdown
BUG IDENTIFIED (not a test error):
- Test:        UserRepository_Insert_WithDuplicateEmail_ThrowsUniqueViolation
- Expected:    DbUpdateException on duplicate email
- Actual:      Second insert succeeds (no unique index)
- Root cause:  Missing unique index on users.email
-> Keeping test RED. Fix required in migration/schema.
```

### Anti-Rationalization

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Test is too strict" | Strict tests catch bugs early | **Keep the assertion** |
| "Works in production" | Production may hide the bug | **Trust the test** |
| "It's just flaky" | Flaky = broken. Find the race. | **Fix isolation / wait strategy** |
| "Time pressure" | Shipping bugs costs more than fixing tests | **Fix before merge** |

---

## Integration Test Quality Gate (MANDATORY)

**Before marking integration tests complete:**

- [ ] Tests live in `YourService.IntegrationTests` with `[Trait("Category","Integration")]`
- [ ] HTTP tests use `WebApplicationFactory<Program>` (in-process, no fixed Kestrel port)
- [ ] External deps provisioned via Testcontainers (dynamic ports, no shared env)
- [ ] Containers started once per class/collection via `IAsyncLifetime` (never per method)
- [ ] Migrations applied against the fresh container before tests
- [ ] Each test isolated (unique data / Respawn / transaction rollback)
- [ ] No class-level parallelism against a shared database
- [ ] Fixtures/builders centralized in `TestSupport` (no local `CreateTest*`)
- [ ] No hardcoded ports, no `Task.Delay` sync hacks, no `.Result`/`.Wait()`
- [ ] Containers disposed in `DisposeAsync`
- [ ] Tests pass 3× consecutively (no flaky tests)

---

## Output Format (Gate 0 - Integration Testing)

```markdown
## Integration Testing Summary

| Metric | Value |
|--------|-------|
| External dependencies | X |
| Integration tests written | Y |
| Tests passed | Y |
| Tests failed | 0 |
| Flaky tests detected | 0 |

### Tests by Component

| Component | Test File | Tests | Container | Status |
|-----------|-----------|-------|-----------|--------|
| Users API | UserApiTests.cs | 6 | postgres:16 | PASS |
| UserRepository | UserRepositoryTests.cs | 8 | postgres:16 | PASS |
| OrderConsumer | OrderConsumerTests.cs | 3 | rabbitmq:3 | PASS |

### Standards Compliance

| Standard | Status | Evidence |
|----------|--------|----------|
| WebApplicationFactory | PASS | ApiFactory : WebApplicationFactory<Program> |
| Testcontainers | PASS | PostgreSqlBuilder / RabbitMqBuilder used |
| Trait for selective runs | PASS | [Trait("Category","Integration")] on all |
| Container reuse | PASS | IClassFixture / ICollectionFixture |
| Isolation | PASS | Respawn reset between tests |
| No hardcoded ports | PASS | grep returns 0 matches |
```

---

## Anti-Rationalization Table (Integration Testing)

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Unit tests cover this" | Unit tests mock the boundary; they don't prove the SQL/HTTP works. | **Write integration tests** |
| "Testcontainers is slow" | Correctness > speed. Reuse containers per collection. | **Use Testcontainers** |
| "docker-compose is easier" | Fixed ports conflict; lifecycle is manual. | **Use Testcontainers** |
| "I'll point at the dev DB" | Shared state corrupts tests and risks real data. | **Provision a container** |
| "Start a container per test" | Turns a suite into minutes. | **`IClassFixture`/`ICollectionFixture`** |
| "Run everything in parallel" | Shared DB races → flaky failures. | **Serialize via a collection or isolate data** |
| "`.Result` is fine here" | Deadlocks and hides exceptions. | **`await` in `async Task`** |
| "Local `CreateTest*` is handy" | Duplication drifts across files. | **Centralize builders in TestSupport** |

---

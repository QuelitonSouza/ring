# C# Standards - Unit Testing

> **Module:** testing-unit.md | **Sections:** 11 | **Parent:** [index.md](index.md)

This module covers unit testing patterns for C# / ASP.NET Core projects. Unit tests verify
code behavior **in isolation**, with every external dependency replaced by a mock or fake.

> **Gate Reference:** This module is loaded by backend engineers during Gate 0 quality
> verification. Ring standards are the baseline; `docs/PROJECT_RULES.md` may add project-specific
> rules but must not weaken the requirements defined here.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [Test Framework & Libraries](#test-framework--libraries-mandatory) | xUnit, FluentAssertions, Moq |
| 2 | [AAA Pattern](#aaa-pattern-mandatory) | Arrange-Act-Assert structure |
| 3 | [Test Naming Convention](#test-naming-convention-mandatory) | `Method_Scenario_ExpectedResult` |
| 4 | [Theory / InlineData / MemberData](#theory--inlinedata--memberdata-mandatory) | Data-driven tests |
| 5 | [Edge Case Coverage](#edge-case-coverage-mandatory) | Minimum edge cases per AC type |
| 6 | [Assertion Requirements](#assertion-requirements-mandatory) | Strong assertions with FluentAssertions |
| 7 | [Mocking](#mocking-mandatory) | Moq (and NSubstitute) patterns |
| 8 | [Async Test Patterns](#async-test-patterns-mandatory) | `async Task`, CancellationToken |
| 9 | [Coverage Threshold](#coverage-threshold-mandatory) | 85% line coverage minimum |
| 10 | [Unit Test Scope & Boundaries](#unit-test-scope--boundaries-mandatory) | Unit vs integration |
| 11 | [Unit Test Quality Gate](#unit-test-quality-gate-mandatory) | Checklist before completion |

**Meta-sections:** [TDD RED → GREEN](#tdd-red--green-mandatory) | [Output Format](#output-format-gate-0---unit-testing) | [Anti-Rationalization Table](#anti-rationalization-table-unit-testing)

---

## Test Framework & Libraries (MANDATORY)

**HARD GATE:** **xUnit** is the mandatory test framework for all C# projects. **FluentAssertions**
is the mandatory assertion library. **Moq** is the default mocking library.

### Standard Stack

| Concern | Library | Status |
|---------|---------|--------|
| Test framework | **xUnit** | MANDATORY |
| Assertions | **FluentAssertions** | MANDATORY |
| Mocking | **Moq** | Default (NSubstitute allowed — see [Mocking](#mocking-mandatory)) |
| Coverage | **coverlet.collector** | MANDATORY |

> **NUnit note:** NUnit and MSTest are competent frameworks, but Ring standardizes on **xUnit**
> for consistency across services. Do not introduce NUnit/MSTest into a new project. If you are
> maintaining a legacy suite already on NUnit, keep it consistent locally, but new test projects
> MUST use xUnit. The mapping is direct: NUnit `[TestFixture]/[Test]` → xUnit class + `[Fact]`;
> NUnit `[TestCase]` → xUnit `[Theory]` + `[InlineData]`; NUnit `[SetUp]` → constructor;
> NUnit `[TearDown]` → `IDisposable.Dispose` / `IAsyncLifetime.DisposeAsync`.

### Test Project Setup

```xml
<!-- YourService.UnitTests.csproj -->
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
    <IsTestProject>true</IsTestProject>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.11.1" />
    <PackageReference Include="xunit" Version="2.9.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.8.2" />
    <PackageReference Include="FluentAssertions" Version="6.12.1" />
    <PackageReference Include="Moq" Version="4.20.72" />
    <PackageReference Include="coverlet.collector" Version="6.0.2" />
  </ItemGroup>

</Project>
```

---

## AAA Pattern (MANDATORY)

**HARD GATE:** Every test MUST follow the **Arrange-Act-Assert** structure, with the three phases
visually separated. A single logical assertion target per test (one behavior, verified with as many
FluentAssertions calls as that behavior needs).

### Required Pattern

```csharp
[Fact]
public async Task CreateAsync_WithValidInput_ReturnsCreatedUser()
{
    // Arrange
    var repository = new Mock<IUserRepository>();
    repository
        .Setup(r => r.CreateAsync(It.IsAny<User>(), It.IsAny<CancellationToken>()))
        .ReturnsAsync((User u, CancellationToken _) => Result<User, AppError>.Success(u));
    var sut = new UserService(NullLogger<UserService>.Instance, repository.Object);
    var request = new CreateUserRequest("John", "john@example.com");

    // Act
    var result = await sut.CreateAsync(request, CancellationToken.None);

    // Assert
    result.IsSuccess.Should().BeTrue();
    result.Value.Name.Should().Be("John");
}
```

> **Convention:** name the system under test `sut` (or the concrete type name). Keep Arrange free
> of assertions; keep Assert free of new behavior.

### FORBIDDEN Pattern

```csharp
// FORBIDDEN: no phase separation, act and assert interleaved
[Fact]
public async Task Test1()
{
    var sut = CreateService();
    (await sut.CreateAsync(Req(), default)).IsSuccess.Should().BeTrue();
    (await sut.CreateAsync(Bad(), default)).IsSuccess.Should().BeFalse(); // two behaviors, one test
}
```

---

## Test Naming Convention (MANDATORY)

**HARD GATE:** All test methods MUST follow `MethodUnderTest_Scenario_ExpectedResult`.

```text
{MethodUnderTest}_{Scenario}_{ExpectedResult}

Examples:
- CreateUser_WithValidInput_ReturnsUser
- CreateUser_WithEmptyName_ReturnsValidationError
- GetById_WithNonExistentId_ReturnsNotFound
- CalculateTotal_WithNegativeAmount_ThrowsArgumentException
- Debit_WhenInsufficientFunds_ReturnsInsufficientFundsError
```

### FORBIDDEN Patterns

| Pattern | Why Wrong | Correct |
|---------|-----------|---------|
| `TestCreateUser` | No scenario, no expected result | `CreateUser_WithValidInput_ReturnsUser` |
| `CreateUserSuccess` | Redundant "Success", no separators | `CreateUser_WithValidInput_ReturnsUser` |
| `Test1`, `Test2` | Non-descriptive | Describe the behavior |
| `ShouldReturnUser` | Missing method + scenario | `CreateUser_WithValidInput_ReturnsUser` |

---

## Theory / InlineData / MemberData (MANDATORY)

**HARD GATE:** When the same behavior is verified across multiple inputs, use `[Theory]` with
`[InlineData]` (or `[MemberData]` / `[ClassData]` for complex cases). Copy-pasted `[Fact]` methods
that differ only by input value are FORBIDDEN — they are the C# equivalent of an un-tabled test.

### InlineData (simple, constant inputs)

```csharp
[Theory]
[InlineData("John", "john@example.com", true)]   // happy path
[InlineData("", "john@example.com", false)]       // empty name
[InlineData("John", "", false)]                   // empty email
[InlineData("John", "invalid-email", false)]      // bad format
[InlineData("John", "a@b.c", true)]               // boundary: minimal valid email
public async Task CreateAsync_WithVariousInputs_ReturnsExpectedResult(
    string name, string email, bool shouldSucceed)
{
    // Arrange
    var sut = CreateService();
    var request = new CreateUserRequest(name, email);

    // Act
    var result = await sut.CreateAsync(request, CancellationToken.None);

    // Assert
    result.IsSuccess.Should().Be(shouldSucceed);
}
```

### MemberData (complex objects / reference types)

```csharp
public static IEnumerable<object[]> InvalidUsers()
{
    yield return new object[] { new CreateUserRequest(new string('a', 256), "a@b.c"), UserError.NameTooLong };
    yield return new object[] { new CreateUserRequest("John", "no-at-sign"), UserError.InvalidEmail };
    yield return new object[] { new CreateUserRequest("<script>", "a@b.c"), UserError.InvalidName };
}

[Theory]
[MemberData(nameof(InvalidUsers))]
public async Task CreateAsync_WithInvalidUser_ReturnsExpectedError(
    CreateUserRequest request, AppError expectedError)
{
    var result = await CreateService().CreateAsync(request, CancellationToken.None);

    result.IsFailure.Should().BeTrue();
    result.Error.Should().Be(expectedError);
}
```

### FORBIDDEN Pattern

```csharp
// FORBIDDEN: duplicated facts that differ only by data → should be a [Theory]
[Fact] public void Validate_EmptyName_Fails()  { /* ... */ }
[Fact] public void Validate_EmptyEmail_Fails() { /* ... */ }
[Fact] public void Validate_BadEmail_Fails()   { /* ... */ }
```

---

## Edge Case Coverage (MANDATORY)

**HARD GATE:** Every acceptance criterion MUST have edge case tests beyond the happy path.

### Minimum Edge Cases by AC Type

| AC Type | Required Edge Cases | Minimum Count |
|---------|---------------------|---------------|
| Input validation | `null`, empty string, boundary values, invalid format, special chars, max length | 3+ |
| CRUD operations | not found, duplicate key, concurrent modification, large payload | 3+ |
| Business logic | zero value, negative numbers, overflow, boundary conditions, invalid state | 3+ |
| Error handling | `CancellationToken` cancelled, connection refused, timeout, invalid response | 2+ |
| Authentication | expired token, invalid signature, missing claims, revoked token | 2+ |

### FORBIDDEN Pattern

```csharp
// FORBIDDEN: only the happy path
[Fact]
public async Task CreateUser_WithValidInput_ReturnsUser()
{
    var result = await _sut.CreateAsync(ValidRequest(), CancellationToken.None);
    result.IsSuccess.Should().BeTrue(); // No edge cases = incomplete test
}
```

---

## Assertion Requirements (MANDATORY)

**HARD GATE:** Use **FluentAssertions**. Assertions MUST be strong and specific. Weak assertions
that only check `!= null` or `IsSuccess == true` without inspecting the payload are FORBIDDEN.

### Strong vs Weak Assertions

```csharp
// FORBIDDEN: weak — proves almost nothing
result.Should().NotBeNull();
result.IsSuccess.Should().BeTrue();

// CORRECT: verify the actual value and key fields
result.IsSuccess.Should().BeTrue();
result.Value.Should().BeEquivalentTo(new
{
    Name = "John",
    Email = "john@example.com",
    Status = UserStatus.Active
});
result.Value.Id.Should().NotBeEmpty();
```

### Error Assertions (never assert "an error happened" only)

```csharp
// FORBIDDEN: only checks that it failed
result.IsFailure.Should().BeTrue();

// CORRECT (Result pattern): assert the specific error
result.IsFailure.Should().BeTrue();
result.Error.Should().Be(UserError.EmailAlreadyExists);
result.Error.Code.Should().Be("USER_EMAIL_EXISTS");
```

### Exception Assertions

```csharp
// CORRECT: assert type AND message/parameter, not just "throws"
var act = () => Money.FromDecimal(-1m, "USD");

act.Should().Throw<ArgumentOutOfRangeException>()
   .WithParameterName("amount")
   .WithMessage("*must be non-negative*");

// Async
var actAsync = async () => await sut.TransferAsync(request, CancellationToken.None);
await actAsync.Should().ThrowAsync<InvalidOperationException>();
```

### Decimal & Money Comparisons

```csharp
// FluentAssertions compares decimal by value — safe:
balance.Available.Should().Be(1000.00m);

// For floating point (avoid in financial code), use tolerance:
ratio.Should().BeApproximately(0.3333, 0.0001);
```

### `require`-style preconditions

FluentAssertions has no fatal/non-fatal split like Go's `require`/`assert`. Put Arrange-phase
preconditions in the Arrange block and let the test fail fast; keep behavior assertions in Assert.

---

## Mocking (MANDATORY)

**HARD GATE:** Mock all external dependencies through their **interfaces**. Hand-written fakes that
duplicate a mocking library are FORBIDDEN. **Moq** is the default; **NSubstitute** is permitted if a
project standardizes on it (do not mix both in one solution).

### Moq (default)

```csharp
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _repository = new(MockBehavior.Strict);
    private readonly ILogger<UserService> _logger = NullLogger<UserService>.Instance;

    private UserService CreateService() => new(_logger, _repository.Object);

    [Fact]
    public async Task CreateAsync_WithValidInput_PersistsAndReturnsUser()
    {
        // Arrange
        var request = new CreateUserRequest("John", "john@example.com");
        _repository
            .Setup(r => r.CreateAsync(
                It.Is<User>(u => u.Name == "John"),
                It.IsAny<CancellationToken>()))
            .ReturnsAsync((User u, CancellationToken _) => Result<User, AppError>.Success(u));

        // Act
        var result = await CreateService().CreateAsync(request, CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value.Name.Should().Be("John");
        _repository.Verify(r => r.CreateAsync(
            It.Is<User>(u => u.Name == "John"),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
```

> **`MockBehavior.Strict`** is recommended: an unexpected call fails the test immediately, catching
> accidental interactions. Use `Loose` only when the noise outweighs the benefit.

### NSubstitute (alternative, if project-standardized)

```csharp
var repository = Substitute.For<IUserRepository>();
repository
    .CreateAsync(Arg.Any<User>(), Arg.Any<CancellationToken>())
    .Returns(call => Result<User, AppError>.Success(call.Arg<User>()));

var result = await new UserService(NullLogger<UserService>.Instance, repository)
    .CreateAsync(request, CancellationToken.None);

result.IsSuccess.Should().BeTrue();
await repository.Received(1).CreateAsync(
    Arg.Is<User>(u => u.Name == "John"), Arg.Any<CancellationToken>());
```

### FORBIDDEN Patterns

```csharp
// FORBIDDEN: hand-written fake that duplicates a mocking library
private sealed class FakeUserRepository : IUserRepository
{
    public Task<Result<User, AppError>> CreateAsync(User u, CancellationToken ct)
        => Task.FromResult(Result<User, AppError>.Success(u)); // use Moq/NSubstitute instead
}
```

> **Fakes are still allowed** for stable, well-known collaborators where a real in-memory
> implementation is clearer than a mock (e.g. `TimeProvider` fakes, an in-memory `IClock`). The
> rule bans re-implementing a *mock* by hand, not purposeful test doubles.

---

## Async Test Patterns (MANDATORY)

**HARD GATE:** Async tests MUST return `async Task` and `await` the system under test.
`async void`, `.Result`, and `.Wait()` are FORBIDDEN in tests (they hide failures and deadlock).

```csharp
// CORRECT
[Fact]
public async Task GetAsync_WhenFound_ReturnsUser()
{
    var result = await _sut.GetAsync(id, CancellationToken.None);
    result.IsSuccess.Should().BeTrue();
}

// FORBIDDEN: async void — the runner cannot observe failures
[Fact]
public async void Broken() { /* ... */ }

// FORBIDDEN: sync-over-async — deadlock / hidden AggregateException
[Fact]
public void AlsoBroken()
{
    var result = _sut.GetAsync(id, CancellationToken.None).Result;
}
```

### Cancellation is a behavior — test it

```csharp
[Fact]
public async Task GetAsync_WhenTokenCancelled_ThrowsOperationCanceled()
{
    using var cts = new CancellationTokenSource();
    cts.Cancel();

    var act = async () => await _sut.GetAsync(id, cts.Token);

    await act.Should().ThrowAsync<OperationCanceledException>();
}
```

### Deterministic time

Never use `DateTime.Now`/`DateTimeOffset.UtcNow` inside code under test. Inject `TimeProvider`
(.NET 8+) and drive it from tests:

```csharp
var timeProvider = new FakeTimeProvider(new DateTimeOffset(2026, 1, 1, 0, 0, 0, TimeSpan.Zero));
var sut = new TokenService(timeProvider);
// ... advance if needed: timeProvider.Advance(TimeSpan.FromMinutes(5));
```

---

## Coverage Threshold (MANDATORY)

**HARD GATE:** Unit test line coverage MUST be **≥ 85%** for the code changed in a task.
Coverage below threshold is a Gate 0 failure.

### Collecting Coverage

```bash
# Collect with coverlet (bundled via coverlet.collector)
dotnet test --collect:"XPlat Code Coverage"

# Or with a threshold that fails the build
dotnet test /p:CollectCoverage=true \
            /p:CoverletOutputFormat=cobertura \
            /p:Threshold=85 \
            /p:ThresholdType=line
```

### What Counts

| Included | Excluded |
|----------|----------|
| Domain logic, services, handlers, validators, mappers | Generated code (`*.g.cs`, migrations) |
| Error branches (failure paths) | `Program.cs` composition root (covered by integration tests) |
| Guard clauses and edge cases | DTOs / records with no logic |

> Coverage is a floor, not a goal. 85% with strong edge-case assertions beats 100% of happy-path-only
> tests. A line executed without a meaningful assertion is not "covered" in spirit.

---

## Unit Test Scope & Boundaries (MANDATORY)

**HARD GATE:** Unit tests verify behavior **in isolation**. All external dependencies MUST be mocked.
Connecting to real databases, message brokers, or HTTP services in a unit test is FORBIDDEN — that is
an integration test (see [testing-integration.md](testing-integration.md)).

### What Belongs in Unit Tests

| Allowed | Tool |
|---------|------|
| Mock repository / service interfaces | Moq / NSubstitute |
| In-memory request/response objects | Record & object literals |
| Fake `TimeProvider` / `IClock` | `FakeTimeProvider` |
| Pure domain logic (entities, value objects) | Direct instantiation |

### What is FORBIDDEN in Unit Tests

| FORBIDDEN | Use Instead |
|-----------|-------------|
| Testcontainers / real PostgreSQL / MongoDB | Mock the repository interface |
| Real Redis / Valkey connection | Mock the cache interface |
| Real RabbitMQ / MassTransit bus | Mock the publisher/consumer interface |
| `WebApplicationFactory` spinning the full app | Belongs in integration tests |
| Outbound HTTP to a real API | Mock `HttpClient` via `HttpMessageHandler` or the typed-client interface |

**If a test needs a container or a real dependency, it is an integration test.** Move it to the
`*.IntegrationTests` project.

### Anti-Rationalization: Scope Boundaries

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Real DB is more realistic" | Realistic = integration test. Unit tests verify logic in isolation. | **Mock the repository interface** |
| "Moq is too verbose for this" | Verbose setup = explicit contract. Hidden real dependency = hidden coupling. | **Use the mock** |
| "I need to verify the SQL" | SQL correctness belongs in integration tests. | **Integration test the query** |
| "Testcontainers is fast enough" | Speed is irrelevant. Unit tests MUST be isolated. | **Mock all external dependencies** |

---

## TDD RED → GREEN (MANDATORY)

**HARD GATE:** New behavior is written test-first. The test MUST fail before implementation exists.

### RED

1. Write the failing test that expresses the acceptance criterion.
2. Run it and **capture the failure output** — a test that passes on first run is not a valid RED.

```text
Failed UserServiceTests.CreateAsync_WithValidInput_ReturnsCreatedUser [4 ms]
  Expected result.IsSuccess to be true, but found false.
```

### GREEN

1. Write the **minimum** code to make the test pass — including required observability
   (structured logging, Activity tracing) per Ring standards; observability is part of GREEN, not a
   later add-on.
2. Run it and **capture the pass output**.

```text
Passed!  -  Failed: 0, Passed: 5, Skipped: 0, Total: 5
```

3. Refactor with tests green.

| Phase | Verification | If missing |
|-------|--------------|------------|
| RED | Failure output contains `Failed` | STOP — the test is not proving anything |
| GREEN | Pass output contains `Passed` | Fix implementation (max 3 attempts) |

---

## Unit Test Quality Gate (MANDATORY)

**Before marking unit tests complete:**

- [ ] xUnit + FluentAssertions + Moq (or NSubstitute) used — no NUnit/MSTest in new projects
- [ ] Every test follows AAA with separated phases
- [ ] Every test method named `Method_Scenario_ExpectedResult`
- [ ] Multi-input behaviors use `[Theory]` (no copy-pasted `[Fact]`s)
- [ ] Each acceptance criterion has 3+ edge cases
- [ ] Assertions inspect values/errors (no bare `NotBeNull` / `IsSuccess`)
- [ ] Error tests assert the specific error (Result) or exception type + message
- [ ] All async tests return `async Task` — no `async void`, `.Result`, `.Wait()`
- [ ] `CancellationToken` behavior tested where relevant
- [ ] Time driven via `TimeProvider`/`FakeTimeProvider` (no `DateTime.Now`)
- [ ] Line coverage ≥ 85% for changed code
- [ ] All tests pass: `dotnet test`
- [ ] No flaky tests (run 3× consecutively)

---

## Output Format (Gate 0 - Unit Testing)

```markdown
## Unit Testing Summary

| Metric | Value |
|--------|-------|
| Acceptance criteria | X |
| Tests written | Y |
| Edge cases per AC | 3+ |
| Tests passed | Y |
| Tests failed | 0 |
| Line coverage | Z% (>= 85%) |

### Tests by Acceptance Criteria

| AC | Test File | Tests | Edge Cases | Status |
|----|-----------|-------|------------|--------|
| AC-1: User creation | UserServiceTests.cs | 6 | 5 | PASS |
| AC-2: User validation | UserValidationTests.cs | 8 | 7 | PASS |

### Standards Compliance

| Standard | Status | Evidence |
|----------|--------|----------|
| xUnit + FluentAssertions + Moq | PASS | Package refs in .csproj |
| AAA pattern | PASS | All tests split Arrange/Act/Assert |
| Naming convention | PASS | All `Method_Scenario_ExpectedResult` |
| Theory for multi-input | PASS | InlineData/MemberData used |
| Strong assertions | PASS | Values & errors asserted |
| Edge cases | PASS | Minimum 3 per AC |
| Coverage | PASS | 87% line coverage |
```

---

## Anti-Rationalization Table (Unit Testing)

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "One test case is enough" | One case proves one scenario. Edge cases catch bugs. | **Add 3+ edge cases** |
| "Theory is overkill, I'll copy the Fact" | Copy-paste rots. One `[Theory]` scales. | **Use `[Theory]`** |
| "Hand-written fakes are simpler" | Simpler now, drift later. | **Use Moq/NSubstitute** |
| "`NotBeNull` proves it works" | Could be wrong type or empty data. | **Assert values and fields** |
| "`IsFailure` proves the error" | Different errors pass silently. | **Assert the specific error** |
| "`async void` is fine in tests" | The runner can't observe failures. | **Return `async Task`** |
| "`.Result` is quicker" | Deadlocks and hides `AggregateException`. | **`await` the call** |
| "Happy path covers it" | Happy path misses most bugs. | **Test edge cases** |
| "I'll add tests later" | Later = never. Tests first. | **Write tests now (RED → GREEN)** |
| "85% is just a number" | It's a floor. Failure paths need cover too. | **Cover error branches to >= 85%** |
| "NUnit is what I know" | Ring standardizes on xUnit for consistency. | **Use xUnit in new projects** |

---

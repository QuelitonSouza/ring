# C# Standards - Property-Based Testing

> **Module:** testing-property.md | **Sections:** 6 | **Parent:** [index.md](index.md)

This module covers property-based testing for C# projects. Property-based tests verify that
**invariants always hold** across hundreds of automatically generated inputs, instead of a handful
of hand-picked cases. The library of record is **FsCheck** (with its xUnit glue,
`FsCheck.Xunit`); **CsCheck** is a permitted pure-C# alternative.

> **Gate Reference:** This module is available to backend engineers during Gate 0 quality
> verification when property testing is required. Ring standards are the baseline; `docs/PROJECT_RULES.md`
> may add project-specific rules but must not weaken the requirements defined here.

---

## Table of Contents

| # | Section | Description |
|---|---------|-------------|
| 1 | [What Is Property-Based Testing](#what-is-property-based-testing) | Purpose and when to use |
| 2 | [Library & Setup](#library--setup-mandatory) | FsCheck.Xunit / CsCheck |
| 3 | [Property Test Pattern](#property-test-pattern-mandatory) | `[Property]` and naming |
| 4 | [Common Properties](#common-properties) | Invariants to test |
| 5 | [Custom Generators & Arbitraries](#custom-generators--arbitraries) | Constraining input |
| 6 | [Property Test Quality Gate](#property-test-quality-gate-mandatory) | Checklist before completion |

**Meta-sections:** [Output Format](#output-format-gate-0---property-based-testing) | [Anti-Rationalization Table](#anti-rationalization-table-property-testing)

---

## What Is Property-Based Testing

Property-based testing verifies that **invariant properties always hold** across many
automatically generated inputs. Instead of asserting "input X gives output Y", you assert
"for all valid inputs, this relationship is true" — and the framework tries hundreds of inputs,
**shrinking** any failure down to the smallest reproducing case.

### Differences from Other Test Types

| Aspect | Unit Test | Property-Based Test |
|--------|-----------|---------------------|
| **What you define** | Input + expected output | A property (invariant) |
| **What it verifies** | One specific case works | The property holds for all generated inputs |
| **Number of inputs** | 5–20 (you write them) | Hundreds (generated) |
| **On failure** | Points at your one case | **Shrinks** to the minimal failing input |

### Examples of Properties

| Domain | Property |
|--------|----------|
| Math | `a + b == b + a` (commutativity) |
| Money | `a.Add(b).Amount >= 0` when `a, b >= 0` (non-negative result) |
| Validation | `Validate(x)` returns an error OR `x` is valid — never throws |
| Serialization | `Deserialize(Serialize(x)) == x` (round-trip) |
| Normalization | `Normalize(Normalize(x)) == Normalize(x)` (idempotency) |
| Retry jitter | `FullJitter(delay) >= TimeSpan.Zero` (always non-negative) |

### When to Use Property-Based vs Theory

| Use Property-Based When | Use `[Theory]` / `[InlineData]` When |
|-------------------------|--------------------------------------|
| Verifying invariants across many inputs | Testing specific known scenarios |
| Verifying "never throws / never negative" guarantees | Asserting exact error messages |
| Mathematical / algebraic properties | Documenting a handful of edge cases |
| Exhaustiveness of validation | Regression cases with fixed values |

Property tests **complement** unit tests; they do not replace them. Keep both.

---

## Library & Setup (MANDATORY)

**HARD GATE:** Property tests MUST use **FsCheck** via `FsCheck.Xunit` (the `[Property]` attribute).
**CsCheck** is permitted for teams that prefer a fluent, pure-C# API — do not mix both in one project.

### FsCheck (default)

```xml
<PackageReference Include="FsCheck.Xunit" Version="3.*" />
```

`FsCheck.Xunit` provides the `[Property]` attribute, which runs the test method as a property:
the method returns `bool` (or `Property`) and its parameters are **generated** by FsCheck.

### CsCheck (alternative)

```xml
<PackageReference Include="CsCheck" Version="4.*" />
```

CsCheck drives generation explicitly from within a `[Fact]` via `Gen.<T>.Sample(...)`.

---

## Property Test Pattern (MANDATORY)

**HARD GATE:** Property tests MUST express a single invariant as a total predicate over generated
inputs. Follow the naming convention `Property_{Subject}_{Invariant}`.

### FsCheck.Xunit — `[Property]`

```csharp
using FsCheck;
using FsCheck.Xunit;

public class JitterProperties
{
    [Property]
    public bool Property_FullJitter_IsNeverNegative(TimeSpan delay)
    {
        // PROPERTY: jitter is always non-negative, for any input delay
        return Jitter.Full(delay) >= TimeSpan.Zero;
    }
}
```

### Returning a `Property` (conditional / labelled)

```csharp
[Property]
public Property Property_Debit_NeverLeavesNegativeBalance(int initial, int debit)
{
    // Constrain to the meaningful domain, then assert the invariant
    return (initial >= 0 && debit >= 0).Implies(() =>
    {
        var account = new Account(initial);
        var result = account.Debit(debit);

        // If the debit succeeded, the balance must remain non-negative
        return result.IsFailure || account.Balance >= 0;
    });
}
```

### Configuring Iteration Count

```csharp
[Property(MaxTest = 1000)] // default is 100
public bool Property_Normalize_IsIdempotent(string input)
{
    var once = Normalizer.Normalize(input);
    var twice = Normalizer.Normalize(once);
    return once == twice;
}
```

### CsCheck equivalent

```csharp
[Fact]
public void Property_FullJitter_IsNeverNegative()
{
    Gen.Int[0, int.MaxValue]
       .Sample(ms => Jitter.Full(TimeSpan.FromMilliseconds(ms)) >= TimeSpan.Zero);
}
```

### Naming Convention

| Level | Pattern | Example |
|-------|---------|---------|
| Unit property | `Property_{Subject}_{Invariant}` | `Property_Money_AdditionIsCommutative` |
| Integration property | `Property_Integration_{Subject}_{Invariant}` | `Property_Integration_Account_AliasIsUnique` |

---

## Common Properties

### 1. Commutativity

```csharp
[Property]
public bool Property_Money_AdditionIsCommutative(int a, int b)
{
    var m1 = Money.FromCents(a, "USD");
    var m2 = Money.FromCents(b, "USD");
    // a + b == b + a
    return m1.Add(m2).Equals(m2.Add(m1));
}
```

### 2. Round-trip (Serialize / Deserialize)

```csharp
[Property]
public bool Property_User_JsonRoundtrips(NonNull<string> name, byte age)
{
    var original = new User(name.Get, age);

    var json = JsonSerializer.Serialize(original);
    var decoded = JsonSerializer.Deserialize<User>(json);

    // Deserialize(Serialize(x)) == x
    return decoded == original;
}
```

### 3. Idempotency

```csharp
[Property]
public bool Property_Normalize_IsIdempotent(string input)
{
    var once = Normalizer.Normalize(input);
    // f(f(x)) == f(x)
    return Normalizer.Normalize(once) == once;
}
```

### 4. Non-Negative / Bounded Result

```csharp
[Property]
public bool Property_Jitter_StaysWithinBounds(uint baseMs)
{
    var delay = TimeSpan.FromMilliseconds(baseMs);
    var jittered = Jitter.Full(delay);
    // 0 <= jittered <= base
    return jittered >= TimeSpan.Zero && jittered <= delay;
}
```

### 5. Validation Consistency (never throws)

```csharp
[Property]
public bool Property_CreateOrganization_NeverThrows(string name, string code)
{
    // PROPERTY: for ANY input, the factory returns a Result — it must not throw
    var result = Organization.Create(name, code);

    // Valid results have a non-empty id; invalid results carry an error
    return result.IsFailure || result.Value.Id != Guid.Empty;
}
```

### 6. Invariant Preservation

```csharp
[Property]
public Property Property_Account_BalanceNeverGoesNegative(uint initial, uint debit)
{
    return true.When(true).Label("balance invariant", () =>
    {
        var account = new Account((int)initial);
        var result = account.Debit((int)debit);
        // Either the debit is rejected, or the balance stays valid
        return result.IsFailure || account.Balance >= 0;
    });
}
```

---

## Custom Generators & Arbitraries

**HARD GATE:** When the raw generated type is too broad (e.g. any `string`, any `int`), constrain it
with a **generator** rather than filtering inside the test body and silently returning `true`.
Silent skips hide untested regions of the input space.

### FsCheck — constrained generator via `Arbitrary`

```csharp
public static class Generators
{
    // Valid, non-empty alias up to 100 chars
    public static Arbitrary<string> Alias() =>
        Gen.Choose(1, 100)
           .SelectMany(len =>
               Gen.Elements("abcdefghijklmnopqrstuvwxyz".ToCharArray())
                  .ArrayOf(len)
                  .Select(chars => new string(chars)))
           .ToArbitrary();
}

public class AliasProperties
{
    [Property(Arbitrary = new[] { typeof(Generators) })]
    public bool Property_Alias_AlwaysValidatesTrue(string alias)
    {
        return AliasValidator.IsValid(alias);
    }
}
```

### Prefer generators over in-body filtering

```csharp
// DISCOURAGED: filtering by returning true hides how much of the space was skipped
[Property]
public bool Property_Weak(string s)
{
    if (s.Length > 100) return true; // skipped — but how often? unknown
    return Validator.IsValid(s);
}

// PREFERRED: constrain generation so every generated input is meaningful
[Property(Arbitrary = new[] { typeof(Generators) })]
public bool Property_Strong(string alias) => Validator.IsValid(alias);
```

If you must skip, use `.When(condition)` / `.Implies(...)` so FsCheck reports discard ratios rather
than counting discards as passes.

---

## Property Test Quality Gate (MANDATORY)

**Before marking property tests complete:**

- [ ] FsCheck.Xunit (or CsCheck) used — not a hand-rolled random loop
- [ ] Every domain invariant with an algebraic property has a property test
- [ ] Mathematical operations checked for commutativity/associativity where applicable
- [ ] Serialization checked for round-trip
- [ ] Normalization checked for idempotency
- [ ] "Never throws" guarantees expressed as properties over the whole input domain
- [ ] Inputs constrained via generators, not silent `return true` filtering
- [ ] Tests named `Property_{Subject}_{Invariant}`
- [ ] All properties pass: `dotnet test`
- [ ] No flaky properties (run 3× consecutively; a shrunk counterexample is a real bug)

### Detection

```bash
# Find property tests
grep -rnE "\[Property" YourService.UnitTests --include=*.cs

# Find domain types that likely warrant property tests (value objects / entities)
grep -rnE "record struct|sealed class .*Money|value object" src --include=*.cs
```

---

## Output Format (Gate 0 - Property-Based Testing)

```markdown
## Property-Based Testing Summary

| Metric | Value |
|--------|-------|
| Domain types | X |
| Properties tested | Y |
| Iterations per property | 100+ |
| Properties passed | Y |
| Properties failed | 0 |

### Properties by Subject

| Subject | Property | Test Method | Status |
|---------|----------|-------------|--------|
| Money | Addition commutative | Property_Money_AdditionIsCommutative | PASS |
| Money | JSON round-trip | Property_Money_JsonRoundtrips | PASS |
| Jitter | Always non-negative | Property_Jitter_IsNeverNegative | PASS |
| Account | Balance never negative | Property_Account_BalanceNeverGoesNegative | PASS |

### Standards Compliance

| Standard | Status | Evidence |
|----------|--------|----------|
| FsCheck.Xunit used | PASS | [Property] attribute on all |
| Naming convention | PASS | All `Property_{Subject}_{Invariant}` |
| Constrained generators | PASS | Custom Arbitrary, no silent skips |
| Invariant coverage | PASS | All domain invariants covered |
```

---

## Anti-Rationalization Table (Property Testing)

| Rationalization | Why It's WRONG | Required Action |
|-----------------|----------------|-----------------|
| "Unit tests cover the logic" | Unit tests check a few cases; properties check the whole domain. | **Add property tests** |
| "Too abstract to test" | No invariant means the code has no contract. Find the invariant. | **Define and test the property** |
| "I'll just write a random loop" | Hand-rolled loops don't shrink; you get a huge unhelpful counterexample. | **Use FsCheck/CsCheck** |
| "Filtering with `return true` is fine" | Silent skips hide untested input regions. | **Constrain with a generator** |
| "Takes too long to write" | 10 lines of property test can catch what 100 unit tests miss. | **Write the property** |
| "Our domain is simple" | Simple domains still have simple invariants (round-trip, idempotency). | **Test them** |
| "The counterexample is unrealistic" | The shrunk input is a real path through your code. | **Fix the code, keep the property** |

---

# Agent instructions

## Need human / user approval?

spawn subagents of fable 5, gpt 5.6 sol, and composer 2.5 fast for decision maker. They are 3 are the hand-right of me (the user).

verbatim output format for each subagent:

```
**YES/NO/YES_WITH_NOTES/NO_WITH_NOTES**:
...

**Reasoning**:

- a
- b
- c
- etc

**Additional from me**:

- a
- b
- c
- etc
```

## Personal behavior & Coding principles (MUST FOLLOW)

- ONLY `composer-2.5` OR `composer-2.5-fast` for any subagent. never use other model, except explicitly said.
- the goal is to make production-level industry-standard batle-proven apps that scales for a busy traffic product.
- dont overengineering.
- YAGNI, DRY, KISS.
- composition over inheritance.
- cohesion over coupling.
- Boy Scout Rule. dont leave any unimportant stubs, traces, and leftovers that can be a tech debt in the future.
- agent-first code.
- focus on make the code working -> optimize for security, performance, size, maintainability, quality -> simplify code.
- prevent code smells.
- be responsible, be professional, be curious, dont prefer assumptions, dont overstepped — proceed when requirements and docs are clear.
- fuck off if you `do too much → realize it → long apology`.
- you are allowed to contradict. dont always agree with me.
- when there are questions that not yet answered by me, confirm again, maybe i forgot.
- on **critical or ambiguous** items (e.g. scope, deletes, auth, merge targets, product intent, refactors): MUST **ask or confirm using question picker with me first** — do not guess.
- **chat proposals are not implementation approval** — answer first; code only when requirements are clear or I explicitly say go.
- **one question batch at a time with QuestionPicker**; use a structured format: single pick, multi pick, or short essay — not a wall of mixed questions. Dependant question should be on a different question batch.
- if docs conflict or stakes are high, stop and ask before implementing.
- DONT explaining things verbosely, if it can be visualized you can use mermaid diagram. **i love visualization**.
- keep helpers, components, types, variables, etc. local until the 2nd consumer; then extract and export.
- if making a utilities, helpers, constants, interfaces/types, and other things that is a local (not used by many), make them inline in the same file (dont over-create-file).

## Agent doc map

[read this](./knowledge-base-of-king-the-user/AGENTS.md)

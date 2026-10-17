# Flow Builder

A tool for creating multiple flows, with steps arranged vertically and paths that can branch.

## Language

**Flow**:
A distinct diagram of steps and the paths between them.
_Avoid_: Workflow (when referring to the diagram)

**Step**:
A named point in a flow, with a plain-text title and an optional description.
_Avoid_: State (when referring to a step)

**Happy path**:
The main sequence of steps in a flow, shown in a single vertical column.

**Branch**:
An alternative path from a decision, shown in a new column to the right.

**Decision**:
A diamond-shaped boolean question with exactly two outcomes: Yes continues below, and No extends to the right. Multiple alternatives are represented by additional decisions to the right, not extra outcomes on one decision.

**Alias card**:
A semi-transparent reference to an existing step, rather than a separate copy of that step.

**Build mode**:
The mode for creating and editing a flow.

**Simulation mode**:
The mode for manually walking through a flow by advancing steps and choosing branches, without executing code or external actions.

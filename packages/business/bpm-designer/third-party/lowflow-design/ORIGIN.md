# lowflow-design source baseline

This directory was initialized from a source snapshot of
[`tsai996/lowflow-design`](https://github.com/tsai996/lowflow-design) at commit
`bc99644d414754e85036cae5247fddde2abb56d8` (2026-09-29 import).

The imported files are `src/`, `package.json`, `README.upstream.md`, and
`LICENSE`. The upstream MIT copyright and permission notice are retained in
`LICENSE`. Levin-specific changes are made directly on this copied source,
starting with server-owned node status overlays for the upstream read-only
mode. The upstream demo entry, mock APIs, Element Plus components, and
converter endpoint remain repository-only reference source; they are not wired
to the Levin application or included in the published npm tarball. Only the
adapted `FlowDesign` entry, recursive tree node and type file, alongside this
provenance note and the MIT license, are shipped for the shared design/runtime
canvas. They use the existing authorization and capability contracts and
remain subject to server fixed-version validation. Do not call the upstream
mock or hosted converter from production code.

Before changing or refreshing this snapshot, compare it against the pinned
commit, retain the license, and review any upstream dependency or API changes.

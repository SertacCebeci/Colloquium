# colloquium:version — Version Management

**Purpose:** Create a new product version (milestone, patch, or hotfix) in the SDLC state. Use this to start a new development milestone after releasing the current one, or to start a patch/hotfix against a released version.

---

## Enforcement Rules

1. Read `.claude/sdlc/state.json`. Verify `schemaVersion = 2`. If not 2, display:

   ```
   ❌ state.json is schema v1. Run /colloquium:version --migrate first.
   ```

   Then stop.

2. **Release guard:** Cannot create a new version while `state.activeSlice` or `state.activeFeature` is non-null. Display:

   ```
   ❌ Cannot create a new version while work is in progress.
   Active slice:   <state.activeSlice>
   Active feature: <state.activeFeature>

   Complete or abandon the active slice first.
   ```

   Then stop.

---

## Execution

### Step 1: Ask version type

Use AskUserQuestion with these questions:

1. What type of version are you creating?
   - **Milestone** — major/minor feature release; new domain work allowed
   - **Patch** — bug fix against a released milestone; inherits domain
   - **Hotfix** — critical emergency fix; inherits domain

2. What is the version label? (e.g., `"User Authentication"`, `"Fix: login regression"`)

3. What is the semver? (e.g., `"1.1.0"` for a minor milestone, `"1.0.1"` for a patch)

4. Which version does this derive from?
   - For **Patch** or **Hotfix**: required — provide the parent version ID (e.g., `"v1"`)
   - For **Milestone**: optional — leave blank if starting fresh

### Step 2: Determine new version ID

Derive the version ID from the semver provided:

- `"1.1.0"` → `"v1.1.0"`
- `"2.0.0"` → `"v2.0.0"`
- `"1.0.1"` → `"v1.0.1"`

If the user provides a label without dots (e.g., `"2"`), use `"v2"` format.

### Step 3: Write to state.json

Add the new version to the versions tree and update the active version pointer.

**For Milestone:**

```json
{
  "activeVersion": "<new-version-id>",
  "activeSlice": null,
  "activeFeature": null,
  "versions": {
    "<previous-active-version-id>": { "state": "released" },
    "<new-version-id>": {
      "id": "<new-version-id>",
      "label": "<label>",
      "type": "milestone",
      "state": "active",
      "semver": "<semver>",
      "parentVersion": "<parent-id or null>",
      "domain": {
        "state": "A0",
        "completed": [],
        "locked": false
      },
      "completedSlices": [],
      "completedFeatures": [],
      "slices": {}
    }
  },
  "lastUpdated": "<ISO timestamp>",
  "lastSkill": "colloquium:version"
}
```

**For Patch or Hotfix:** Same structure but:

- `"type": "patch"` (or `"hotfix"`)
- `"domain": { "inherits": "<parentVersionId>" }` instead of the inline domain object

**Merge into the versions tree — do not overwrite other version entries.**

### Step 4: Display completion banner

```
════════════════════════════════════════════════════════════════
✅ Version created — <new-version-id>
════════════════════════════════════════════════════════════════
Version:  <new-version-id> (<semver>) — <label>
Type:     <milestone | patch | hotfix>
Parent:   <parentVersionId or "none">
Domain:   <"fresh — run /colloquium:domain-frame" | "inherited from <parent>">

Previous version <old-id> marked as released.

Next: /colloquium:sdlc
════════════════════════════════════════════════════════════════
```

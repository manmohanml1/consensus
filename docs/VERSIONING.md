# Versioning

Product releases use Semantic Versioning. Domain compatibility is versioned independently:

- decision ruleset;
- command/event schema;
- room projection schema;
- place normalization schema;
- database migrations;
- analytics event schema.

Historical decisions retain the ruleset and candidate facts used at resolution. Never reinterpret them with current rules.

Release tags are annotated `vMAJOR.MINOR.PATCH` tags created only after explicit owner authorization. The tag, root package, web package, and changelog versions must agree.

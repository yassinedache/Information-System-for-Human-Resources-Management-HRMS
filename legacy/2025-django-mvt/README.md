# 2025 version (reference only)

The original Django MVT code of the university project, kept as it was submitted, for reference.
It is not used by the current application (see the root [README](../../README.md)).

Known problems, fixed in the new version:

- `RH_DEP/views.py` defines a view function named `Employe`, which replaces the imported `Employe` model:
  every page that lists or edits employees fails with `'function' object has no attribute 'objects'`.
- `Conge.save()` subtracts the leave length from the balance on every save of an approved leave, and counts weekends.
- Several pages (contracts, leave, employee space) are static templates with no data, and there is no login.
- The secret key was hard-coded with `DEBUG = True`; it has been removed from `projet_SI/settings.py` and must never be reused.

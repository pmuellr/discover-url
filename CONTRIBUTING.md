contributing to this project
================================================================================

Awesome!  We're happy that you want to contribute.

Make sure that you're read and understand the [Code of Conduct].

Here are the general guidelines for contributing:

* For any bug you want to fix, or feature you want to add, make sure there's
  an issue describing the bug or feature.

  * Make sure there is some discussion with the current contributors so that
    folks understand the design of your bug fix or new feature.  It would suck
    if you spent a lot of time on something that didn't get included in the
    project - but of course feel free to fork this project if your contribution
    isn't accepted!

* Create a feature branch in your own clone of this repo (for folks without
  r/w access to the main repo), and then issue a pull request for that
  branch on the main repo.

  * PRs should be single-focused, and not include any "drive-by patches".

  * PRs should include tests (if code was changed) and docs describing new
    behavior.

  * The final merge of a PR onto the master should be rebased and squashed.

  * The final commit message should be useful.  It should contain a link to the
    issue that it relates to.

* Ensure the existing tests - and your new tests - actually pass, if there are
  tests!

  * Tests can be run via `npm test`, which uses the Node.js test runner.

  * There is no build step; `discover-url.js` is used as-is.  Keep it free of
    errors when type-checked in VS Code (it uses JSDoc types and `// @ts-check`).

  * `discover-url.js` must stay loadable as a plain `<script src>`, so it can't
    use `import`, `export`, or `import.meta`.  New exports go in both lists at
    the bottom of the file; `test/browser.test.mjs` checks that they match.

* Never force push to the master branch.  Force pushing to bug / feature
  branches is both fine and expected.

[Code of Conduct]: CODE_OF_CONDUCT.md

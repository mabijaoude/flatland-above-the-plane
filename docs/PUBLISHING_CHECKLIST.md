# GitHub publishing checklist

Status at the September 2026 release review. The repository remains private and the current improvement pass targets development only. A working development release is not approval to change visibility or production.

## Stop before changing visibility

- [ ] **Approve and complete historical Blender metadata cleanup.** The current three `.blend` sources have been sanitized and opened successfully in Blender. Older Git/LFS versions still contain a local file-browser workspace directory. A clean current checkout does not remove historical objects. Decide on a reviewed history rewrite or a fresh sanitized public history, retain a private backup, and inspect every retained commit and LFS object before publication. This destructive step has deliberately not been performed without owner approval.
- [ ] Confirm ownership or documented permission for every original artwork/source file. Automated checks cannot establish ownership or settle worldwide copyright status.
- [ ] Designate a confidential conduct-reporting channel and replace the explicit pending-channel notice in `CODE_OF_CONDUCT.md`. The owner's profile currently has no public contact method; do not expose a personal email without permission.
- [ ] Approve the final public source snapshot and repository visibility change explicitly.

## Repository foundations

- [x] Repository identity and live-demo link are established: `mabijaoude/flatland-above-the-plane`.
- [x] MIT license, contribution guide, code of conduct, security policy, issue/PR templates, source context, and rights map are present.
- [x] README explains the mathematical roots, the Victorian class and gender hierarchy, the adaptation boundary, the complete book, application features, development, privacy, and limitations.
- [x] Current commit identities use the owner's GitHub no-reply address. This does not substitute for the binary-history gate above.
- [x] Credentials, local deployment receipts, and browser-test artifacts are ignored by Git and excluded from the Docker context.
- [x] Git LFS setup is documented; CI downloads artwork and builds fail on unresolved asset pointers.
- [x] The release guard checks retained book/license notices, dependency notices, and current Blender metadata.
- [x] CI has read-only permissions, commit-pinned actions, unit/build checks, and production-artifact browser tests.

## GitHub settings and maintenance

- [x] Description, live-demo homepage, and relevant topics are configured; Issues are enabled.
- [ ] Enable private vulnerability reporting when supported for the repository; verify the private-report link in `SECURITY.md` after enabling it.
- [ ] Require the **Verify** CI job on `main` and disallow force pushes except during an explicitly approved history migration. Branch-protection access returned a plan/visibility restriction while this repository was private; recheck available settings at launch.
- [x] No open Dependabot security alerts were returned during this review. Optional update PRs remain separate work, not a reason to combine unrelated migrations with launch fixes.
- [x] Weekly dependency maintenance includes Docker image updates. Each production dependency update must refresh the third-party notices as needed and pass browser tests.
- [ ] Add a GitHub social-preview image and selected screenshots before the announcement.
- [ ] Enable Discussions only if somebody will monitor them; it is not required to be open source.

## Release verification and announcement

- [x] Local release checks, unit tests, production build, dependency audit, and browser smoke tests pass; see [review evidence](RELEASE_REVIEW.md).
- [x] The book retains its Project Gutenberg header, footer, illustrations, and license; optional context never gates direct reading.
- [x] Current public README copy contains no private-network/deployment-only address.
- [ ] Finish the development deployment and final touch-oriented five-minute interaction; record its outcome in the review evidence.
- [ ] Before production promotion, approve the tested development image and verify the public route on that exact release. Do not rebuild a different image as a shortcut to promotion.
- [ ] Once the history and rights gates are complete, change repository visibility, recheck public links/settings and a fresh LFS clone, then tag the first public release.
- [ ] Prepare the LinkedIn post with the live demo, repository, a short dimensional example, and an honest description of accessibility/browser limitations.

Physical iOS/Android and assistive-technology testing remain follow-up coverage, not something this review claims to have performed. Larger product ideas are in [Astra improvements](../Astra%20improvements.md).

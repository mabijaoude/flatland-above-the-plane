# GitHub publishing checklist

Status at the September 2026 release review and launch-preparation follow-up. The original improvement pass targeted development only. The owner subsequently approved committing/pushing the final documentation and deploying the verified release to both development and production. The repository remains private; production approval does not change GitHub visibility.

## Stop before changing visibility

- [x] **Approve and rewrite historical Blender metadata.** The owner approved cleanup on September 4 local time (September 5 UTC). All active branches now use sanitized Blender sources throughout their history. The rewrite preserved commit structure and the current application snapshot; an independent clone verified all retained history and LFS content. A complete private Git/LFS backup is retained outside the repository. See [cleanup status](HISTORY_CLEANUP.md).
- [x] **Decide whether residual historical metadata blocks publication.** On September 5, 2026, the owner accepted the limited historical folder-path disclosure and chose to proceed without requesting a GitHub server-side purge. Active branch history is sanitized, but old PR references and orphaned LFS objects have not been purged. This is an accepted residual risk, not a claim of complete server-side erasure. See [cleanup status](HISTORY_CLEANUP.md).
- [x] The owner confirmed on September 5, 2026 that the original project work is theirs to release. Third-party material remains subject to the licenses and notices recorded in the rights map; this confirmation does not establish worldwide copyright status.
- [x] Designate a confidential conduct-reporting channel: `flatland-sim.storable683@aleeas.com`. The SimpleLogin alias is enabled on a free-plan domain, forwards to the maintainer's private mailbox, and is documented in `CODE_OF_CONDUCT.md` and as the fallback in `SECURITY.md`. The personal mailbox address is not published.
- [x] Verify incoming contact mail. On September 5, 2026, the owner supplied a screenshot of a test message received in the forwarding inbox, addressed to the project alias and sent through a SimpleLogin reverse alias. This confirms incoming forwarding; it does not show the outgoing reply. The earlier self-mail notification was not counted as a forwarding test.
- [x] Verify reply sender-address privacy. On September 5, 2026, the owner supplied a screenshot from the receiving test account with expanded sender details: `Flatland — Above the Plane <flatland-sim.storable683@aleeas.com>`, mailed and signed by `aleeas.com`. Together with the incoming test, this confirms the receive-and-reply workflow and the project alias as the visible reply sender. This is not a full raw-header or message-content audit; signatures and quoted text still need to be checked for personal details. See [SimpleLogin's reply instructions](https://simplelogin.io/docs/getting-started/reverse-alias/).
- [ ] Approve the final public source snapshot and repository visibility change explicitly.

## Repository foundations

- [x] Repository identity and live-demo link are established: `mabijaoude/flatland-above-the-plane`.
- [x] MIT license, contribution guide, code of conduct, security policy, issue/PR templates, source context, and rights map are present.
- [x] README explains the mathematical roots, the Victorian class and gender hierarchy, the adaptation boundary, the complete book, application features, development, privacy, and limitations.
- [x] Current commit identities use the owner's GitHub no-reply address. This is separate from the historical metadata decision above.
- [x] Credentials, local deployment receipts, and browser-test artifacts are ignored by Git and excluded from the Docker context.
- [x] Git LFS setup is documented; CI downloads artwork and builds fail on unresolved asset pointers.
- [x] The release guard checks retained book/license notices, dependency notices, and current Blender metadata.
- [x] CI has read-only permissions, commit-pinned actions, unit/build checks, and production-artifact browser tests.

## GitHub settings and maintenance

- [x] Description, live-demo homepage, and relevant topics are configured; Issues are enabled.
- [ ] Enable private vulnerability reporting when supported for the repository; verify the private-report link in `SECURITY.md` after enabling it.
- [ ] Require the **Verify** CI job on `main` and disallow force pushes except during an explicitly approved history migration. Branch-protection access returned a plan/visibility restriction while this repository was private; recheck available settings at launch.
- [x] No open Dependabot security alerts were returned during the release review. The eight optional update PRs were subsequently closed without merging for history cleanup; their proposed changes are preserved on sanitized branches in the private backup. Review any wanted updates in fresh PRs after cleanup rather than reopening old references.
- [x] Weekly dependency maintenance includes Docker image updates. Each production dependency update must refresh the third-party notices as needed and pass browser tests.
- [x] Add a visual README with five real application screenshots and prepare `public/social-preview.jpg` (1200 × 630) for link sharing. Website Open Graph and Twitter metadata reference that image.
- [ ] Optional announcement polish: upload `public/social-preview.jpg` under repository **Settings → General → Social preview**. This GitHub repository setting is separate from the website's automatic link preview; the README screenshots do not depend on it.
- [ ] Enable Discussions only if somebody will monitor them; it is not required to be open source.

## Release verification and announcement

- [x] Local release checks, unit tests, production build, dependency audit, and browser smoke tests pass; see [review evidence](RELEASE_REVIEW.md).
- [x] The book retains its Project Gutenberg header, footer, illustrations, and license; optional context never gates direct reading.
- [x] Current public README copy contains no private-network/deployment-only address.
- [x] Complete three five-minute application interactions, including a touch-oriented visit on the updated development service; record findings and regression fixes in the review evidence.
- [x] The owner approved the final development deployment and production promotion on September 5, 2026 local time. The release workflow must run CI, verify the development image, promote that exact image without rebuilding, and verify the public route and publication receipt before reporting completion. Runtime evidence belongs in the deployment receipts rather than credentials or machine-specific paths in this public checklist.
- [ ] Once explicit release approval is given, change repository visibility, recheck public links/settings and a fresh LFS clone, then tag the first public release. The contact test is complete; the owner has confirmed original-work ownership and accepted the residual historical metadata risk. A GitHub purge is not required by that decision. Existing clones must not merge or push pre-cleanup history.
- [x] Prepare the release description and LinkedIn draft in [First public release](FIRST_RELEASE.md). Post only after the repository is public and its links have been rechecked.

Physical iOS/Android and assistive-technology testing remain follow-up coverage, not something this review claims to have performed. Larger product ideas are in [Astra improvements](../Astra%20improvements.md).

# Pre-public history cleanup

Status: September 5, 2026 UTC. The repository remains private. This is a metadata cleanup, not a new application release or permission to publish.

## Completed

- Retained a verified private mirror, complete Git bundle, and all 24 original LFS objects outside the source repository. The backup deliberately contains pre-cleanup data and must never be published or pushed back to this repository.
- Used `git-filter-repo` 2.47.0 in sensitive-data-removal mode on an isolated mirror. All 33 mirrored commits were retained, including archived dependency proposals and PR history for analysis.
- Replaced only three old Blender LFS object references with their sanitized equivalents. Byte comparisons proved that the source files differ only in one workspace directory each; the current application tree was unchanged.
- Updated all three remaining GitHub branches atomically with exact expected-old-commit leases. Eight automated dependency PRs were closed without merging; Dependabot removed their remote branches. Their proposed changes remain preserved on sanitized branches in the private backup.
- Verified an independent ordinary GitHub clone: all 13 retained release commits and 21 referenced LFS objects passed the metadata and integrity checks. The only path-pattern matches were deliberate, fictitious examples in the privacy regression tests. Commit identities use GitHub no-reply addresses.
- Aligned the working checkout with sanitized history and removed its old reachable references/reflogs. Application code, dev and production deployments, and repository visibility were not changed by the rewrite.

## Residual risk accepted by the owner

GitHub retains read-only references for 14 old pull requests, plus cached objects and three orphaned LFS objects. An ordinary clone does not include those PR refs. Rewriting branches cannot itself erase those server-held copies.

On September 5, 2026, the owner reviewed the limited historical folder-path disclosure and explicitly chose to proceed without a server-side purge. The metadata finding was a local workspace directory, not a credential or the contents of personal documents. A purge is therefore no longer a publication gate. This decision accepts the residual disclosure; it does not mean GitHub has erased the old objects or grant permission to change repository visibility.

A private Support request was prepared but has not been submitted. Keep it, the old object identifiers, and backup files private. If the owner later wants removal, GitHub determines eligibility under its [official removal procedure](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository). A successful purge would need separate verification of affected refs and LFS objects; a clean ordinary clone alone does not prove it.

## Existing clones and deployments

Do not run an ordinary merge/pull from an old checkout and push the result: that can restore the removed history. Prefer a fresh clone. Preserve any uncommitted work privately and transfer only reviewed changes onto sanitized history, never merge an old branch wholesale.

Running NAS images were deliberately left alone. Their recorded commit identifiers predate the rewrite even though the reviewed application content is unchanged. A future approved deployment/promotion must explicitly account for that provenance; do not relabel or replace existing runtime images just to make their commit labels match.

Return to the [publishing checklist](PUBLISHING_CHECKLIST.md) for the remaining ownership, reporting-channel, repository-settings, and release-approval gates.

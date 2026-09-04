# GitHub publishing checklist

The repository now contains the standard public-facing files and automated checks. Complete the owner-specific items below before changing repository visibility.

## Required before first public push

- [ ] Choose the final GitHub owner and repository slug.
- [ ] Review the entire Git history for names, email addresses, internal URLs, and files that should not be public.
- [ ] Decide whether historical commit email addresses are acceptable. Changing future Git configuration does not remove addresses from existing commits; rewriting history is a separate, destructive operation.
- [ ] Confirm that every file in `art_source/` and `public/assets/` was created by a contributor or is covered by a documented license.
- [ ] Run `pnpm check:release`, `pnpm test`, and `pnpm build` from a clean dependency install.
- [ ] Inspect `dist/THIRD_PARTY_NOTICES.txt` and the in-app Project Gutenberg header and footer.
- [ ] Create the GitHub repository, add the remote, and push a review branch before making `main` public.

## GitHub settings

- [ ] Set the description to emphasize the 2D → 3D → 4D thought experiment.
- [ ] Add topics such as `flatland`, `higher-dimensions`, `threejs`, `react`, `simulation`, and `mathematics`.
- [ ] Enable Issues and Discussions only if they will be monitored.
- [ ] Enable private vulnerability reporting.
- [ ] Require the `CI / verify` check before merging to `main`.
- [ ] Enable Dependabot alerts and review automated dependency updates.
- [ ] Add a social preview image and screenshots that show the plane, Native vision, and Closed Room interaction.

## Release review

- [ ] Confirm that README links resolve under the final repository URL.
- [ ] Verify desktop, keyboard-only, touch, and reduced-motion behavior.
- [ ] Confirm that no deployment-only or private-network URL appears in public copy.
- [ ] Confirm that the context page remains optional and that “Read the book” still opens the source directly.
- [ ] Tag the first public release only after the source, rights, and third-party notices are included in the built artifact.

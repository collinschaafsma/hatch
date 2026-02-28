export function generateGitSafetyRule(): string {
	return `---
description: Git safety rules for feature branch development
---

On feature branches, \`git commit\` and \`git push\` are encouraged — commit early and often.

Always confirm before running destructive or shared-branch git commands:
- \`git push --force\`, \`git branch -D\`, \`git reset --hard\`
- \`git merge\`, \`git rebase\`, \`git cherry-pick\` on \`main\`
- Any push to \`main\`
`;
}

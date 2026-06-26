# Workspace Customization Rules

- **Auto-Push to GitHub:** Whenever any file modification is done and successfully verified, the agent must automatically stage, commit, and push the changes to the configured GitHub repository.
  - Command: `git add . ; git commit -m "update: [brief description]" ; git push origin main`

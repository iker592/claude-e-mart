---
description: Deploy the application to the specified environment
---

Deploy the application to the environment specified in "$ARGUMENTS" (default: staging).

Steps:
1. Verify all tests pass
2. Build the application
3. Run the deployment script
4. Verify the deployment was successful
5. Report the deployment status

If any step fails, stop and report the error clearly.

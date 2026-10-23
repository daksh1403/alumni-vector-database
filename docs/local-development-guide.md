\# Local Development and Troubleshooting



This guide explains how to set up, run, and verify the Alumni Vector Database locally.



\## Prerequisites



\- Node.js 22 or later

\- npm

\- Access to a configured Qdrant Cloud cluster



\## 1. Install Dependencies



Open PowerShell in the repository root and run:



```powershell

npm ci

```



\## 2. Configure Environment Variables



Create a local configuration file using the example:



```powershell

Copy-Item .env.example .dev.vars

notepad .dev.vars

```



Configure these variables with the actual values for your Qdrant deployment:



\- `QDRANT\_URL`: URL of the Qdrant cluster.

\- `QDRANT\_API\_KEY`: API key for the cluster.

\- `VECTOR\_ADMIN\_TOKEN`: Random token used to authorize administrative operations.



Never commit `.dev.vars` or publish API keys.



\## 3. Run Automated Tests



Run:



```powershell

npm test

```



These tests verify application logic, input validation, search request construction, authorization, and error handling.



Passing automated tests does not guarantee that a live Qdrant cluster is reachable.



\## 4. Start the Development Server



Run:



```powershell

npm run dev

```



The local Worker normally runs at `http://localhost:8787`.



Keep the terminal open while testing.



\## 5. Check API Health



Open a second terminal and run:



```powershell

Invoke-RestMethod http://localhost:8787/api/health

```



A successful response indicates that the Worker can retrieve collection information from Qdrant.



\## 6. Troubleshooting



\### The local server cannot be reached



Check that `npm run dev` is running and that the terminal reports the local server URL.



\### The health endpoint returns 503



Check that the cluster URL and API key are correct, the cluster is available, and the configured collection exists.



Inspect the development-server terminal for errors. Never expose API keys in logs or messages.



\### Search returns no useful results



Check that the collection contains the intended records and that those records contain the fields expected by the application.



Follow the repository's seeding instructions before running operations that modify database contents.



\### Tests pass but the application cannot connect



Automated tests and live database checks verify different things. Check local configuration and database connectivity separately.



\## 7. Before Committing Changes



Run:



```powershell

npm test

git status

git diff --check

```



Review the changes and ensure that `.dev.vars`, API keys, private exports, and other secrets are not included in the commit.


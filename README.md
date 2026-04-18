# Zovate

**Work Smarter, Collaborate Better, Deliver Faster**

Zovate is a comprehensive project management and team collaboration platform designed for freelancers and small teams. Manage tasks, streamline workflows, automate repetitive processes, and leverage AI-powered insights—all in one intuitive platform.

---

## ✨ What is Zovate?

Zovate combines task management, team collaboration, and workflow automation into a single, powerful SaaS application. Whether you're a solo freelancer managing multiple clients or a growing team of 20+, Zovate scales with your needs.

### Core Capabilities

🎯 **Project & Task Management**  
Organize work into projects and tasks with custom workflows, deadlines, priorities, and status tracking. Get real-time visibility into what's being done, by whom, and when it's due.

👥 **Team Collaboration**  
Foster seamless communication with real-time comments, mentions, file attachments, and activity feeds. Keep discussions in context, reduce email clutter, and make decisions faster.

⚙️ **Workflow Automation**  
Automate repetitive tasks and processes. Create custom workflows that trigger actions based on conditions, reducing manual work and human error.

🤖 **AI-Powered Insights**  
Get intelligent recommendations for task prioritization, team workload balancing, project timeline predictions, and risk identification. Let AI surface what matters most.

🔗 **Integrations & Extensibility**  
Connect with your favorite tools—Slack, Google Drive, GitHub, Zapier, and more. Build custom integrations via our public API.

---

## 🚀 Key Features

### Real-Time Collaboration
- **Instant Updates**: Changes sync across all team members in real-time
- **Comments & Mentions**: Tag teammates, discuss directly on tasks
- **Activity Feed**: See what changed and who did it
- **File Sharing**: Attach documents, images, and links without leaving the platform

### Custom Workflows
- **Drag-and-Drop Workflow Builder**: Design processes without code
- **Automation Rules**: Trigger actions when conditions are met (e.g., "Move to Done → notify client")
- **Pipeline Views**: See tasks flow through custom stages
- **Multi-Project Templates**: Reuse workflows across similar projects

### AI-Powered Insights
- **Smart Task Recommendations**: Identifies overdue tasks and bottlenecks
- **Workload Prediction**: Alerts when team members are overallocated
- **Project Health Metrics**: Risk scoring and timeline forecasting
- **Intelligent Search**: Find tasks, discussions, and files instantly

### Seamless Integrations
- **Slack**: Get notifications, update tasks from Slack
- **Google Drive & OneDrive**: Embed and sync files
- **Calendars**: Sync deadlines with Google Calendar, Outlook
- **GitHub & GitLab**: Link commits and PRs to tasks
- **Zapier**: Connect 5,000+ apps
- **REST API**: Build custom integrations

### Flexible Access & Security
- **Works Everywhere**: Web app, responsive mobile design
- **Role-Based Access Control**: Define who can see and do what
- **Data Encryption**: End-to-end encryption for sensitive data
- **SOC 2 Compliant**: Enterprise-grade security
- **Single Sign-On (SSO)**: SAML 2.0 for enterprise teams

---

## 🎯 Who Should Use Zovate?

### Freelancers & Agencies
Manage multiple client projects, track billable hours, and maintain project profitability—all from one dashboard.

### Software Development Teams
Link tasks to code commits, automate deployments, track sprints, and integrate with your DevOps stack.

### Marketing & Creative Teams
Collaborate on campaigns, approve creative assets, manage timelines, and automate approval workflows.

### Product Teams
Collect feedback, prioritize features, manage roadmaps, and communicate product decisions to stakeholders.

### Any Growing Team
If you outgrew spreadsheets and need better collaboration tools, Zovate is built for you.

---

## 🛠️ Built with Modern Tech Stack

This Turborepo monorepo includes:

### Applications
- **`web`**: Next.js application (customer-facing web app)
- **`docs`**: Next.js documentation site

### Shared Packages
- **`@repo/ui`**: Reusable React component library used by both web and docs apps
- **`@repo/eslint-config`**: Centralized ESLint configuration (includes Next.js and Prettier rules)
- **`@repo/typescript-config`**: Shared TypeScript configurations

### Technologies
- **Language**: 100% TypeScript for type safety
- **Frontend**: Next.js, React, Tailwind CSS
- **Code Quality**: ESLint, Prettier, TypeScript
- **Monorepo Management**: Turborepo with local caching

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (recommended) or npm/yarn

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/zovate.git
cd zovate
pnpm install
```

### Development

Start the development server for all apps and packages:

```bash
# With global turbo (recommended)
turbo dev

# Without global turbo
pnpm dlx turbo dev
```

This starts:
- Web app on `http://localhost:3000`
- Documentation on `http://localhost:3001`
- All packages in watch mode

### Build

Build all apps and packages for production:

```bash
turbo build
```

Build a specific app:

```bash
turbo build --filter=web
turbo build --filter=docs
```

### Other Commands

**Linting:**
```bash
turbo lint
```

**Type Checking:**
```bash
turbo type-check
```

**Format Code:**
```bash
turbo format
```

---

## 📦 Project Structure

```
zovate/
├── apps/
│   ├── web/              # Customer web application (Next.js)
│   └── docs/             # Documentation site (Next.js)
├── packages/
│   ├── ui/               # Shared React components
│   ├── eslint-config/    # ESLint configurations
│   └── typescript-config/# TypeScript configurations
├── package.json          # Root workspace dependencies
├── turbo.json            # Turborepo configuration
└── pnpm-workspace.yaml   # pnpm workspace configuration
```

---

## 🔄 Turborepo & Caching

This project uses **Turborepo** for intelligent task orchestration and caching:

- **Local Caching**: Build artifacts are cached locally, speeding up subsequent runs
- **Remote Caching** (via Vercel): Cache builds across team members and CI/CD pipelines

### Enable Remote Caching

1. Sign up for [Vercel](https://vercel.com) (free)
2. Authenticate:
   ```bash
   turbo login
   ```
3. Link your repository:
   ```bash
   turbo link
   ```

Now your team shares build caches, dramatically reducing build times.

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create a feature branch**: `git checkout -b feature/your-feature`
3. **Make your changes** and commit: `git commit -m "Add your feature"`
4. **Run tests & linting**: `turbo lint && turbo type-check`
5. **Push to your fork**: `git push origin feature/your-feature`
6. **Open a Pull Request** with a clear description

### Code Standards
- Write TypeScript—no JavaScript
- Follow ESLint rules (enforced)
- Format code with Prettier
- Add tests for new features
- Keep commits atomic and descriptive

### Development Tips
- Use `turbo --help` to see available commands
- Use `turbo run <task> --filter=<package>` to run tasks for specific packages
- Check `turbo.json` for configured tasks

---

## 📚 Documentation

- **Getting Started Guide**: [docs/GETTING_STARTED.md](./docs/GETTING_STARTED.md)
- **API Documentation**: [api.zovate.com](https://api.zovate.com) (or wherever your docs are hosted)
- **Component Library**: [http://localhost:3001](http://localhost:3001) (run `turbo dev` and navigate to docs app)

---

## 🔐 Security

- **Data Protection**: All data is encrypted in transit (TLS 1.3) and at rest (AES-256)
- **Authentication**: Secure password hashing with bcrypt, optional SSO (SAML 2.0)
- **Compliance**: SOC 2 Type II certified, GDPR compliant
- **Audit Logs**: Complete activity audit trail for compliance
- **Security Reporting**: Found a vulnerability? Email [security@zovate.com](mailto:security@zovate.com)

---

## 💰 Pricing

Zovate offers flexible pricing for teams of all sizes:

| Plan | Seats | Monthly | Best For |
|------|-------|---------|----------|
| **Starter** | Up to 5 | $29 | Solo freelancers & micro-teams |
| **Professional** | Up to 25 | $99 | Growing teams |
| **Enterprise** | Unlimited | Custom | Large organizations & compliance needs |

**Free tier available** with limited features. [View full pricing](https://zovate.com/pricing)

---

## 📊 Roadmap

We're constantly improving Zovate. Coming soon:

- 🎨 Advanced design mockup tools
- 📱 Native iOS & Android apps
- 🤖 Expanded AI capabilities (predictive analytics, natural language task creation)
- 🌍 Multi-language support
- 📊 Advanced reporting & analytics
- ⏰ Time tracking & billing integration

[View full roadmap](https://zovate.com/roadmap)

---

## 🆘 Support & Community

- **Help Center**: [help.zovate.com](https://help.zovate.com)
- **Email Support**: [support@zovate.com](mailto:support@zovate.com)
- **Community Forum**: [community.zovate.com](https://community.zovate.com)
- **Twitter/X**: [@ZovateApp](https://twitter.com/ZovateApp)
- **Discord**: [Join our community](https://discord.gg/zovate)

---

## 📄 License

Zovate is proprietary software. Unauthorized reproduction or modification is prohibited. See [LICENSE](./LICENSE) for details.

---

## 🙏 Acknowledgments

Built with modern open-source tools:
- [Next.js](https://nextjs.org/) for frontend framework
- [Turborepo](https://turborepo.dev/) for monorepo management
- [TypeScript](https://www.typescriptlang.org/) for type safety
- [Tailwind CSS](https://tailwindcss.com/) for styling
- The incredible open-source community

---

**Made with ❤️ by the Zovate Team**

[Visit our website](https://zovate.com) | [Schedule a demo](https://zovate.com/demo) | [Pricing](https://zovate.com/pricing)

---

### Quick Links
- [Report a Bug](https://github.com/zovate/zovate/issues)
- [Request a Feature](https://github.com/zovate/zovate/discussions)
- [Security Policy](./SECURITY.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

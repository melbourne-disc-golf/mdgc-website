# Melbourne Disc Golf Club website (WIP)

[![Deployment Status](https://img.shields.io/github/check-runs/melbourne-disc-golf/mdgc-website/HEAD?label="deployment")](https://github.com/melbourne-disc-golf/mdgc-website/commits/main)

A modern website for the Melbourne Disc Golf Club.

## 📋 Project Status

Mike Williams is currently in the midst of porting the existing WordPress site to a modern static website. The plan is to prove viability by end of Oct 2025, and complete migration by the end of Nov.

To get an idea of what's left to do, see

- [**open issues** on GitHub](https://github.com/mdgc/mdgc-website/issues)

## 🌐 Live Site

A preview of new site is available at:

- https://mdgc.pages.dev/

Once development is complete, we will change the existing site URL to refer to the new one.

## ✏️ Making changes to the site

The site is managed using code hosted on GitHub:

- https://github.com/melbourne-disc-golf/mdgc-website

### Getting access

In order to make changes to the website, ask Mike Williams to add you as a "collaborator" on the GitHub repository.  You will need to register for a (free) [GitHub account](https://github.com/signup) (if you don't already have one).

### For non-technical users

There are two ways to edit content without needing to understand Git or programming.

#### Using the CMS

We have integrated a Content Management System (CMS) into the site, for management of _structured_ content. This is the recommended way to add and edit:

- **Events**
- **News**
- **Courses**
- **Board Members**

To use the CMS:
  - Visit https://mdgc.pages.dev/cms
  - Log in with your GitHub account
  - Edit content as desired
  - Press "Publish"

Hint: pages which can be edited in the CMS _usually_ have a pencil icon in the footer:

<p align="center">
  <img width="300" src="./docs/edit-in-cms.png" alt="Edit in CMS link">
</p>

#### Using GitHub's web interface

Other pages are not CMS-managed but you can edit them online in GitHub.
  - Navigate to the file you want to edit on GitHub
  - Click the pencil icon to edit
  - Make your changes using Markdown
  - Commit the changes with a description
  - The site will automatically rebuild and deploy

### For technical users

If you're comfortable with Git and development tools:
  - Clone the repository: `git clone https://github.com/melbourne-disc-golf/mdgc-website.git`
  - Make your changes locally
  - Test them using `pnpm run dev`
  - Commit and push: `git commit -am "Description" && git push`

### Re-deployment after changes

When you make changes to the site source-code on GitHub - using either the CMS, or the GitHub
web interface - it triggers an automatic "build" and "deployment" process, which updates the live site.

**Redployment of the site after a change takes about one minute**.

You can observe the process on the [Cloudflare dashboard](https://dash.cloudflare.com/1dbfd2793b506e08151b86bd944859b5/pages/view/mdgc).
Tip: if you're wondering whether your changes are live yet, check the "last updated" timestamp in bottom-left of the page footer.

## ⚙️ Development

### 🏗️ Tech Stack
- **Type**: Static (generated) site
- **Framework**: [Astro](https://astro.build) 5.12.8
- **Styling**: [Tailwind CSS](https://tailwindcss.com) 4.1.11
- **CMS**: [Decap CMS](https://decapcms.org) (backed by Git)
- **Deployment**: [Cloudflare Pages](https://pages.cloudflare.com)

### Running locally

Run `pnpm run dev` to start the development server.

Visit http://localhost:4321 to view the site locally.

### Commands

All commands are run from the root of the project, from a terminal:

| Command                    | Action                                           |
| :------------------------- | :----------------------------------------------- |
| `pnpm install`             | Installs dependencies                            |
| `pnpm run dev`             | Starts local dev server at `localhost:4321`      |
| `pnpm run build`           | Build your production site to `./dist/`          |
| `pnpm run preview`         | Preview your build locally, before deploying     |
| `pnpm run astro ...`       | Run CLI commands like `astro add`, `astro check` |
| `pnpm run astro -- --help` | Get help using the Astro CLI                     |

### Project Structure

```text
/
├── public/
│   └── images/
├── src
│   ├── assets/
│   ├── components/
│   ├── layouts/
│   └── pages/
├── package.json
├── existing-site/
└── existing-site/    # Original site files (reference only)
```

To learn more about the folder structure of an Astro project, refer to [our guide on project structure](https://docs.astro.build/en/basics/project-structure/).

## Content Migration

As of Oct 2025, the existing WordPress site is hosted at:

- https://www.melbournediscgolf.com/

The `existing-site/` directory contains a summary of the contents and structure of the WordPress site.

## Comparison to existing site

### WordPress vs static site

MDGC's existing website is based on WordPress. WordPress is a "dynamic" platform, which generates web-pages on-the-fly, as users browse.

In constrast, this rebuild is a "static website", meaning that the web-pages are pre-built, meaning much less work needs to be done on the "server" when people use the site.  Because of this, it should be:

  - **Faster**. A static site loads almost instantly, even on mobile or low-bandwidth connections.
  - **Cheaper**. Static sites can be hosted very cheaply - often for free. No ongoing fees for WordPress hosting, security plugins, or maintenance work.
  - **Much more reliable**. Static websites don’t crash or break after software updates. Once it’s live, it just works — no background software to maintain.
  - **Much more secure**. WordPress sites are one of the most common targets for hackers. A static site, by contrast, has no login system or database for attackers to get into. That means no security headaches, no emergency fixes, and no risk of losing content.

### Moving parts

#### Code hosting = GitHub (free)

The website code needs to be hosted somewhere. [GitHub](https://github.com) is a great option, and their Free plan support hosting of Git repositories with multiple collaborators. Anyone who needs to edit the website would need to register for a (free) GitHub account.

#### Site build and hosting = Cloudflare Pages (free)

[Cloudflare Pages](https://pages.cloudflare.com) is a platform for static websites. We have things configured such that any change to the website code (on GitHub) triggers a "build" and update of the site, which is then "served" by Cloudflare.

On their Free [plan](https://developers.cloudflare.com/pages/platform/limits/), Cloudflare Pages provides unlimited bandwidth and 500 builds per month. This should be more than sufficient for MDGC's needs.

#### Editing experience

The experience of people _editing_ the website will be quite different, for those used to WordPress. In particular, the new solution
will not provide a WYSIWYG ("what you see is what you get") editing experience, and it will be harder to change site _styling_, without some technical knowledge. However - though a combination of Sveltia CMS and the GitHub UI - we should be able to make it pretty easy for non-technical folks to edit and add _content_.

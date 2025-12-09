# **App Name**: Project Zenith

## Core Features:

- User Authentication: Secure user registration, login, and role-based access control (admin, editor, viewer) managed via Firebase Auth and Firestore.
- Dashboard: One-page dashboard displaying sub-project cards with the latest progress log summaries.
- Weekly Update Workflow: Create and update progress logs with a 'Copy from Last Week' feature, including smart roadblocks carry-forward based on keywords and the use of previous 'nextWeekPlan'.
- Detail View Timeline: Clicking on a sub-project card opens a full-screen modal with a vertical timeline of all historical progress logs.
- Excel Export: Export data to Excel in three formats: summary of all projects, single project summary, and single sub-project history. Ensures styling, merging and layout match existing report.
- Admin User Management: Admin page to approve pending users and assign roles, only visible to admins.
- Project Deletion with Confirmation: Admin-only feature to delete projects, requiring a confirmation modal with the user typing 'DELETE'.
- Firestore Integration: Use Firestore as the database for projects, sub-projects, and progress logs, utilizing security rules to manage data access.

## Style Guidelines:

- Primary color: Dark teal (#008080) evoking a sense of reliability and professionalism.
- Background color: Very light teal (#F0FFFF), offering a clean, unobtrusive backdrop.
- Accent color: Orange (#FFA500) to highlight key interactive elements and important alerts such as overdue projects.
- Font pairing: 'Belleza' (sans-serif) for headlines and 'Alegreya' (serif) for body text; combination conveys elegance and readability. 
- Code font: 'Source Code Pro' for displaying any code snippets or technical details.
- Use Lucide React icons to represent various actions and statuses within the application.  Ensure icons are clear, consistent, and complement the overall design.
- Responsive grid layout (grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4) for the dashboard to ensure usability across different screen sizes. One-page anti-scroll design prioritized.
- Subtle animations for loading states and transitions to improve user experience.
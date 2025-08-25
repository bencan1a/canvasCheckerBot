# User Story Queries

This document lists canonical user-story queries extracted for testing and QA.

Each entry contains:
- Query: natural-language query
- Source: origin of the query
- Acceptance check: minimal expectation to validate query handling

---

1. Query: "What should I work on first this weekend?"
   - Source: user_provided_list
   - Acceptance check: Returns a prioritized list of tasks mentioning deadlines and estimated effort.

2. Query: "What assignments are overdue and how badly is that hurting my grades?"
   - Source: user_provided_list
   - Acceptance check: Identifies overdue assignments and provides an estimated impact on grades.

3. Query: "Which of my missing assignments would give me the biggest grade boost if I turned them in?"
   - Source: user_provided_list
   - Acceptance check: Ranks missing assignments by estimated grade improvement.

4. Query: "How am I doing in Spanish compared to my other classes?"
   - Source: user_provided_list
   - Acceptance check: Compares performance metrics and highlights relative standing.

5. Query: "Are there any big projects coming up that I should start working on now?"
   - Source: user_provided_list
   - Acceptance check: Lists upcoming large projects with start recommendations.

6. Query: "What classes should I focus on to improve my overall GPA the most?"
   - Source: user_provided_list
   - Acceptance check: Recommends classes where effort yields highest expected GPA improvement.

7. Query: "What's due this week that I haven't started yet?"
   - Source: user_provided_list
   - Acceptance check: Shows imminent deadlines with progress status and flags unstarted items.

8. Query: "Are there any tests or quizzes I should be studying for?"
   - Source: user_provided_list
   - Acceptance check: Surfaces upcoming assessments within the planning window.

9. Query: "What homework can I actually get done tonight vs what needs more time?"
   - Source: user_provided_list
   - Acceptance check: Splits tasks by estimated time to completion and marks doable items.

10. Query: "What schoolwork do I need to catch up on?"
    - Source: user_provided_list
    - Acceptance check: Aggregates overdue and unstarted items across classes.

11. Query: "Help me plan my study schedule for the next two weeks"
    - Source: user_provided_list
    - Acceptance check: Produces a balanced two-week study plan aligned with deadlines and available time.

12. Query: "Which teachers are the strictest about late work and what do I owe them?"
    - Source: user_provided_list
    - Acceptance check: Identifies teacher late-work policies and outstanding submissions by teacher.

13. Query: "I have 3 hours to study tonight - what will help my grades the most?"
    - Source: user_provided_list
    - Acceptance check: Prioritizes study activities by expected grade benefit for a 3-hour session.

14. Query: "What would happen to my grades if I skipped the assignments due tomorrow?"
    - Source: user_provided_list
    - Acceptance check: Estimates short-term grade impact and lists affected assignments.

---

Execution log:
- ConPort check: context_portal/context.db detected and ConPort vector data present.
- Tools exercised during extraction (programmatic): get_product_context, get_active_context, get_decisions, get_custom_data(ProjectGlossary), semantic_search_conport.
- Source material consulted: README.md example queries, docs/SYSTEM_GUIDE.md, test/integration/* tests, and ConPort search results.
- Files produced by this step:
  - test/conport_user_story_queries.json
  - docs/testing/user_story_queries.md
- Notes: Creation of the JSON and Markdown files was performed after user-approved mode switch to code mode. Automated acceptance tests and git commit are pending.

---
todolist app by react
Welcome to TodoApp, a simple and intuitive task management app built with React Native. This app helps you organize your tasks with features like priorities, categories, tags, and due dates. Follow this guide to get started and use the app effectively.
Getting Started

Install the App:

Ensure you have the app installed on your iOS or Android device.
If you're a developer, clone the repository and run npm install to install dependencies, then start the app with expo start.


Requirements:

The app requires an internet connection for full functionality, but it can work offline with limited features.
Ensure you have the Expo Go app if running in development mode.


Backend Setup:

The app connects to a backend API. Make sure the EXPO_PUBLIC_BACKEND_URL is set in your environment or Expo config to point to your backend server.



How to Use the App
Main Screen

Header: Displays "My Tasks" and shows an offline indicator if you're not connected to the internet.
Search Bar: Type in the search bar to find tasks by title, description, tags, or category.
Filter Tabs: Switch between "All", "Pending", and "Completed" tasks to view specific tasks.
Filter Options: Tap the filter icon to show filters for priority (low, medium, high, urgent) and category (e.g., Work, Personal, Shopping).
Stats: Tap the stats icon to view task statistics like total tasks, completed tasks, and tasks by priority or category.
Task List: Shows your tasks with details like title, priority, category, due date, and tags. Swipe down to refresh the list.
Add Task: Tap the blue "+" button to open the new task form.

Adding a Task

Tap the blue "+" button to open the task creation modal.
Fill in the details:
Title: Enter a short task name (required).
Description: Add more details about the task (optional).
Priority: Choose Low, Medium, High, or Urgent.
Category: Select a category like Work, Personal, or Shopping.
Due Date: Tap to set a due date using the date picker.
Tags: Type a tag and tap the "+" button to add it (up to 10 tags).


Tap "Save" to add the task or "Cancel" to discard.

Managing Tasks

Complete a Task: Tap a task to mark it as completed or uncompleted.
Delete a Task: Tap the trash icon next to a task and confirm to delete it.
View Task Details: Each task shows its priority (color-coded), category, due date (if set), and tags.
Overdue Tasks: Tasks past their due date are highlighted with a red border.

Filters and Search

Search: Type keywords to filter tasks by title, description, tags, or category.
Priority Filter: Select a priority to show only tasks of that priority.
Category Filter: Choose a category to view tasks in that category.
Status Filter: Use the tabs to view all, pending, or completed tasks.

Viewing Statistics

Tap the stats icon to open the stats modal.
See an overview of total tasks, completed tasks, pending tasks, and overdue tasks.
View breakdowns of tasks by priority and category.

Offline Mode

If you're offline, the app loads tasks from local storage.
You can still add, complete, or delete tasks, and changes will sync when you're back online.

Features

Task Organization: Categorize tasks, set priorities, and add tags for better organization.
Due Dates: Set due dates and see if tasks are overdue.
Search and Filter: Easily find tasks with search and filter options.
Stats: Track your productivity with detailed task statistics.
Offline Support: Manage tasks even without an internet connection.
Responsive Design: Works smoothly on both iOS and Android.

Troubleshooting

App Not Loading Tasks: Check your internet connection or restart the app.
Offline Mode Issues: Ensure you have tasks saved locally from a previous session.
API Errors: Verify the backend URL is correct and the server is running.
Date Picker Issues: Make sure you select a date in the future for due dates.

Developer Notes

The app uses React Native with Expo, AsyncStorage for offline storage, and Ionicons for icons.
Backend API endpoints:
GET /tasks: Fetch tasks with optional query parameters (priority, category, search, completed).
POST /tasks: Create a new task.
PUT /tasks/:id: Update task completion status.
DELETE /tasks/:id: Delete a task.
GET /tasks/stats: Fetch task statistics.


Styles are defined in the styles object using StyleSheet.create.

Feedback
Have suggestions or issues? Feel free to report them to the development team or submit a pull request if you're contributing to the code.
Enjoy staying organized with TodoApp!
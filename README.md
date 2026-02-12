# FairShare: Multi-Currency Expense Splitter

## What’s This About?

You’ll build a bill-splitting application (similar to Splitwise) using React and TypeScript. This app allows users to manage multiple groups (projects), track expenses in different currencies, and calculate a final settlement plan to show "who owes whom" in a single target currency.

## Main Features

1. **Project Management**
   - Create Project: Users can create a new project (e.g., "Japan Trip", "Friday Dinner").
   - Switch Context: Users can switch between different projects via a sidebar or dropdown.
   - Isolation: Data (participants and expenses) must be isolated per project.

2. **Participant Management**
   - Manage People: Within a project, users can add or remove participants.
   - Validation: You cannot remove a participant if they already have recorded expenses.

3. **Expense Logging**
   - Add Expense: Create a record of who paid what.
     - Payer: Select one person from the participant list.
     - Amount: Number input.
     - Currency: Dropdown selection.
     - Description: (Optional) What was this for?
   - Supported Currencies: USD, TWD, JPY, EUR
   - List View: Display a list of all expenses in the current project.
   - Consider how users can handle mistakes or make corrections in the expenses list.

4. **Settlement & Calculation**
   - Target Currency Setting: Each project has a "Settlement Currency" setting (e.g., settle everything in TWD).
   - Calculate Button: A prominent button to trigger the calculation.
     - Generate a list of transactions to settle debts (e.g., "Alice pays Bob $500").
   - Result Display: Open a Dialog/Modal showing the calculation results.

5. **Exchange Rates**
   - Use this free API for rates: https://open.er-api.com/v6/latest/TWD

6. **UI Reference**
   - Improve the basic UI. You may use MUI or other styling library.

## Extra Ideas (Optional)

Feel free to add any of these if you want:

- Any nice-to-have functions and operations
- Support keyboard shortcuts
- Fix TypeScript warnings
- Make it run faster
- Clean up repeated code
- Any cool ideas you have!

## How We’ll Grade It

We’ll look at:

- If it does all the main stuff
- How it handles errors and weird cases
- How clean and organized the code is
- If it follows good coding habits
- How well TypeScript is used
- If it’s easy and nice to use
- Make it look nice
- Use the right input types
- Show input errors right away
- Add friendly error messages

## What to Submit

Send us:

- Your code
- Any notes about how it works or choices you made (in comments)

Good luck!
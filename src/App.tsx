import React, { useState } from "react";
import "./styles.css";

// --- Types ---
export type Currency = "USD" | "TWD" | "JPY" | "EUR";

export interface Participant {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  payerId: string;
  amount: number;
  currency: Currency;
  description: string;
}

export interface Project {
  id: string;
  name: string;
  participants: Participant[];
  expenses: Expense[];
  targetCurrency: Currency;
}

// --- Constants ---
const CURRENCIES: Currency[] = ["USD", "TWD", "JPY", "EUR"];

// --- Mock Data (For UI visualization only) ---
const INITIAL_PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Japan Trip (Mock)",
    participants: [
      { id: "u1", name: "Alice" },
      { id: "u2", name: "Bob" },
    ],
    expenses: [
      {
        id: "e1",
        payerId: "u1",
        amount: 1000,
        currency: "JPY",
        description: "Lunch",
      },
    ],
    targetCurrency: "TWD",
  },
];

export default function App() {
  // TODO: Implement state management for projects
  const [projects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>("p1");
  const [isSettlementOpen, setIsSettlementOpen] = useState(false);

  // Helper to get active project
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  // --- Actions (To be implemented by candidate) ---

  const handleAddProject = () => {
    console.log("TODO: Add Project");
  };

  const handleAddParticipant = (name: string) => {
    console.log("TODO: Add Participant", name);
  };

  const handleRemoveParticipant = (id: string) => {
    console.log("TODO: Remove Participant", id);
  };

  const handleAddExpense = (expense: Omit<Expense, "id">) => {
    console.log("TODO: Add Expense", expense);
  };

  const handleCalculate = () => {
    console.log("TODO: Calculate Settlement");
    setIsSettlementOpen(true); // Just to show the modal UI
  };

  const handleTargetCurrencyChange = (currency: Currency) => {
    console.log("TODO: Update Target Currency", currency);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h2>Projects</h2>
        {projects.map((p) => (
          <div
            key={p.id}
            className={`project-item ${
              p.id === activeProjectId ? "active" : ""
            }`}
            onClick={() => setActiveProjectId(p.id)}
          >
            {p.name}
          </div>
        ))}
        <button className="add-project-btn" onClick={handleAddProject}>
          + New Project
        </button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <header className="header">
          <h1>{activeProject.name}</h1>
          <div>
            <label>Settlement Currency: </label>
            <select
              value={activeProject.targetCurrency}
              onChange={(e) =>
                handleTargetCurrencyChange(e.target.value as Currency)
              }
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* 1. Participant Manager */}
        <div className="section">
          <h3>Participants</h3>
          <div className="form-row">
            <ParticipantInput onAdd={handleAddParticipant} />
          </div>
          <div className="tag-list">
            {activeProject.participants.map((p) => (
              <div key={p.id} className="tag">
                {p.name}
                <button onClick={() => handleRemoveParticipant(p.id)}>x</button>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Expense Input */}
        <div className="section">
          <h3>Add Expense</h3>
          <ExpenseForm
            participants={activeProject.participants}
            onAdd={handleAddExpense}
          />
        </div>

        {/* 3. Expense List */}
        <div className="section">
          <h3>Expenses List</h3>
          {activeProject.expenses.length === 0 ? (
            <p>No expenses yet.</p>
          ) : (
            activeProject.expenses.map((e) => {
              const payerName =
                activeProject.participants.find((p) => p.id === e.payerId)
                  ?.name || "Unknown";
              return (
                <div key={e.id} className="expense-item">
                  <span>
                    <strong>{payerName}</strong> paid{" "}
                    <strong>
                      {e.amount} {e.currency}
                    </strong>
                  </span>
                  <span>{e.description}</span>
                </div>
              );
            })
          )}
        </div>

        {/* 4. Action */}
        <button
          style={{ width: "100%", padding: "15px" }}
          onClick={handleCalculate}
        >
          Calculate Settlement
        </button>

        {/* Settlement Modal (Static Dummy) */}
        {isSettlementOpen && (
          <div
            className="modal-overlay"
            onClick={() => setIsSettlementOpen(false)}
          >
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h2>Settlement Plan</h2>
              <p>Target: {activeProject.targetCurrency}</p>
              <hr />
              <div
                style={{ padding: "20px", textAlign: "center", color: "#666" }}
              >
                [ TODO: Render Calculation Results Here ]
              </div>
              <button
                style={{ marginTop: "20px", width: "100%" }}
                onClick={() => setIsSettlementOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Sub-Components ---

function ParticipantInput({ onAdd }: { onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd(name);
    setName("");
  };
  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: "flex", gap: "10px", width: "100%" }}
    >
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit">Add</button>
    </form>
  );
}

function ExpenseForm({
  participants,
  onAdd,
}: {
  participants: Participant[];
  onAdd: (e: Omit<Expense, "id">) => void;
}) {
  // Keep local state for form inputs to be interactive
  const [payerId, setPayerId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<Currency>("TWD");
  const [description, setDescription] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      payerId,
      amount: parseFloat(amount),
      currency,
      description,
    });
    // Optional: Reset form
    setAmount("");
    setDescription("");
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-row">
        <select
          value={payerId}
          onChange={(e) => setPayerId(e.target.value)}
          style={{ flex: 1 }}
        >
          <option value="">-- Who Paid? --</option>
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: "100px" }}
        />
        <select
          value={currency}
          onChange={(e) => setCurrency(e.target.value as Currency)}
        >
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ flex: 1 }}
        />
        <button type="submit">Add Expense</button>
      </div>
    </form>
  );
}

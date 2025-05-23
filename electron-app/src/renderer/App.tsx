import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { ContactWithSummary } from './types/contact';
import { combineContactData } from './utils/dataLoader';
import { Dashboard } from './components/Dashboard';
import { ContactDetail } from './components/ContactDetail';
import { Insights } from './components/Insights';
import './App.css';

type ViewType = 'dashboard' | 'insights';

function App() {
  const [contacts, setContacts] = useState<ContactWithSummary[]>([]);
  const [selectedContact, setSelectedContact] =
    useState<ContactWithSummary | null>(null);
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const contactData = await combineContactData();
        setContacts(contactData);
      } catch (err) {
        console.error('Failed to load contact data:', err);
        setError('Failed to load contact data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleContactSelect = (contact: ContactWithSummary) => {
    setSelectedContact(contact);
  };

  const handleBackToContacts = () => {
    setSelectedContact(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading contacts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Determine what to render in main content
  const renderMainContent = () => {
    if (selectedContact) {
      return (
        <ContactDetail
          contact={selectedContact}
          contacts={contacts}
          onBack={handleBackToContacts}
        />
      );
    }

    if (currentView === 'dashboard') {
      return (
        <Dashboard contacts={contacts} onContactSelect={handleContactSelect} />
      );
    }

    return <Insights contacts={contacts} />;
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar */}
      <div
        className={`relative bg-white border-gray-200 transition-all duration-300 flex flex-col ${
          sidebarCollapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Navigation Items */}
        <div className="flex-1 py-6">
          <nav className="space-y-2 px-3">
            <button
              type="button"
              onClick={() => {
                setCurrentView('dashboard');
                setSelectedContact(null);
              }}
              className={`${
                sidebarCollapsed
                  ? 'w-10 h-10 justify-center p-0'
                  : 'w-full px-3 py-3'
              } flex items-center gap-3 rounded-lg transition-all duration-200 ${
                currentView === 'dashboard' && !selectedContact
                  ? 'bg-green-100 text-green-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-xl">🏠</span>
              {!sidebarCollapsed && <span>Dashboard</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                setCurrentView('insights');
                setSelectedContact(null);
              }}
              className={`${
                sidebarCollapsed
                  ? 'w-10 h-10 justify-center p-0'
                  : 'w-full px-3 py-3'
              } flex items-center gap-3 rounded-lg transition-all duration-200 ${
                currentView === 'insights' && !selectedContact
                  ? 'bg-purple-100 text-purple-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-xl">📊</span>
              {!sidebarCollapsed && <span>Insights</span>}
            </button>
          </nav>
        </div>

        {/* Clickable Border */}
        <div
          className="absolute top-0 right-0 w-1 h-full hover:w-2 bg-gray-200 hover:bg-purple-400 cursor-col-resize transition-all duration-200 z-10"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setSidebarCollapsed(!sidebarCollapsed);
            }
          }}
          role="button"
          tabIndex={0}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto">{renderMainContent()}</div>
    </div>
  );
}

export default function AppWithRouter() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
      </Routes>
    </Router>
  );
}

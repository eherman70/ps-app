import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import InputTypes from '../InputsTypes';
import IssueInputs from '../IssueInputs';

function InputsManagement() {
  const [activeTab, setActiveTab] = useState('types');

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Inputs Management</h2>

      <div className="mb-6">
        <div className="flex space-x-2 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('types')}
            className={`px-6 py-3 font-medium ${activeTab === 'types' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 dark:text-gray-400'}`}
          >
            Register Inputs/Advances
          </button>
          <button
            onClick={() => setActiveTab('issue')}
            className={`px-6 py-3 font-medium ${activeTab === 'issue' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 dark:text-gray-400'}`}
          >
            Issue Inputs/Advances
          </button>
        </div>
      </div>

      {activeTab === 'types' && <InputTypes />}
      {activeTab === 'issue' && <IssueInputs />}
    </div>
  );
}

export default InputsManagement;

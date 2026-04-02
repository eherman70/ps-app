import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import InputTypes from '../InputsTypes';
import IssueInputs from '../IssueInputs';

function InputsManagement() {
  const { activeTabOverride, setActiveTabOverride } = useAppContext();
  const [activeTab, setActiveTab] = useState(activeTabOverride || 'types');

  useEffect(() => {
    if (activeTabOverride) {
      setActiveTab(activeTabOverride);
      setActiveTabOverride(null);
    }
  }, [activeTabOverride, setActiveTabOverride]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Inputs Management</h2>



      {activeTab === 'types' && <InputTypes />}
      {activeTab === 'issue' && <IssueInputs />}
    </div>
  );
}

export default InputsManagement;

import React from 'react';
import type { TenderDetails } from '../types/tender';

interface TenderDetailsProps {
  tender: TenderDetails;
  onClose: () => void;
  onBid: () => void;
}

const TenderDetailsComponent: React.FC<TenderDetailsProps> = ({ tender, onClose, onBid }) => {
  return (
    <div className="tender-details p-6 bg-white rounded shadow-md">
      <button onClick={onClose} className="text-blue-600 hover:underline mb-4">
        &larr; Back to Listings
      </button>
      
      <h1 className="text-3xl font-bold mb-2">{tender.Title}</h1>
      <div className="flex items-center space-x-4 mb-6 text-sm text-gray-500">
        <span>Ref: {tender.Id}</span>
        <span className={`px-2 py-1 rounded ${tender.Status === 'Open' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
          {tender.Status}
        </span>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Description</h3>
        <p className="text-gray-700 whitespace-pre-wrap">{tender.Description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-50 p-4 rounded">
          <span className="block text-sm text-gray-500">Opening Date</span>
          <span className="font-medium">{new Date(tender.OpeningDate).toLocaleDateString()}</span>
        </div>
        <div className="bg-gray-50 p-4 rounded">
          <span className="block text-sm text-gray-500">Closing Date</span>
          <span className="font-medium">{new Date(tender.ClosingDate).toLocaleDateString()}</span>
        </div>
      </div>

      <div className="actions border-t pt-4 flex justify-end">
        {tender.Status === 'Open' ? (
          <button
            onClick={onBid}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 transition"
          >
            Submit Bid
          </button>
        ) : (
          <button disabled className="bg-gray-300 text-gray-500 px-6 py-2 rounded cursor-not-allowed">
            Bidding Closed
          </button>
        )}
      </div>
    </div>
  );
};

export default TenderDetailsComponent;

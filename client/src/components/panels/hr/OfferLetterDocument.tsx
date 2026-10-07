import React from 'react';
import { format } from 'date-fns';

interface OfferLetterData {
  id: string;
  candidateName: string;
  candidateEmail: string;
  designation: string;
  department: string;
  joiningDate: string;
  salary: number;
}

export function OfferLetterDocument({ data }: { data: OfferLetterData }) {
  if (!data) return null;

  return (
    <div id={`offer-letter-${data.id}`} className="bg-white p-10 font-sans text-gray-800 w-[800px] h-[1130px] border relative">
      <div className="flex justify-between items-center border-b-2 border-primary pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">UMS</h1>
          <p className="text-sm text-gray-500">123 Tech Park, Innovation Hub, City - 400001</p>
          <p className="text-sm text-gray-500">hr@pype-erp.com | +91-9876543210</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">Date: {format(new Date(), 'MMM dd, yyyy')}</p>
          <p className="text-sm text-gray-500">Ref: UMS/HR/OL/{data.id.substring(0, 6).toUpperCase()}</p>
        </div>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Subject: Offer of Employment</h2>
        <p className="mb-2">Dear <span className="font-bold">{data.candidateName}</span>,</p>
        <p className="mb-4">
          Following our recent discussions, we are delighted to offer you the position of 
          <span className="font-bold"> {data.designation}</span> in the <span className="font-bold">{data.department}</span> department 
          at UMS.
        </p>
      </div>

      <div className="space-y-4 mb-8">
        <p><strong>1. Remuneration:</strong> Your annual Cost to Company (CTC) will be <span className="font-bold">₹{Number(data.salary).toLocaleString()}</span>, subject to statutory deductions.</p>
        <p><strong>2. Date of Joining:</strong> Your expected date of joining is <span className="font-bold">{format(new Date(data.joiningDate), 'MMM dd, yyyy')}</span>.</p>
        <p><strong>3. Probation:</strong> You will be on a probation period of 3 months from your date of joining. Upon satisfactory performance, your employment will be confirmed.</p>
        <p><strong>4. Notice Period:</strong> During probation, the notice period is 15 days on either side. Post confirmation, it will be 30 days.</p>
        <p><strong>5. Working Hours:</strong> Standard working hours are from 9:30 AM to 6:30 PM, Monday to Friday.</p>
      </div>

      <div className="mb-12">
        <p className="mb-4">
          Please signify your acceptance of this offer by signing and returning a copy of this letter along with the required joining documents.
        </p>
        <p>We look forward to welcoming you to the team and wish you a successful career with us!</p>
      </div>

      <div className="grid grid-cols-2 gap-8 mt-16 pt-8 absolute bottom-20 w-[calc(100%-5rem)]">
        <div>
          <p className="mb-12">Sincerely,</p>
          <p className="font-bold border-t border-gray-400 pt-2 w-48 text-center">Human Resources</p>
          <p className="text-sm text-gray-500 text-center w-48">UMS</p>
        </div>
        <div className="text-right flex flex-col items-end">
          <p className="mb-12">Accepted By,</p>
          <p className="font-bold border-t border-gray-400 pt-2 w-48 text-center">{data.candidateName}</p>
          <p className="text-sm text-gray-500 text-center w-48">Signature & Date</p>
        </div>
      </div>
    </div>
  );
}

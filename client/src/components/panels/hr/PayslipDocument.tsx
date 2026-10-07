import React from 'react';
import { format } from 'date-fns';

interface Payroll {
  id: string;
  user?: { name: string; email: string };
  month: string;
  basicSalary: number;
  grossSalary: number;
  netSalary: number;
  allowances: any;
  deductions: any;
  bonus: number;
  overtime: number;
  status: string;
  createdAt: string;
}

export function PayslipDocument({ payroll }: { payroll: Payroll }) {
  if (!payroll) return null;

  const totalAllowances = Object.values(payroll.allowances || {}).reduce((acc: number, val: any) => acc + Number(val), 0);
  const totalDeductions = Object.values(payroll.deductions || {}).reduce((acc: number, val: any) => acc + Number(val), 0);

  return (
    <div id={`payslip-${payroll.id}`} className="bg-white p-8 font-sans text-gray-800 w-[800px] h-auto border">
      <div className="flex justify-between items-center border-b-2 border-primary pb-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">UMS</h1>
          <p className="text-sm text-gray-500">123 Tech Park, Innovation Hub, City - 400001</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold uppercase text-gray-700">Payslip</h2>
          <p className="text-sm font-semibold mt-1">Month: {payroll.month}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="space-y-1">
          <p><span className="font-semibold w-32 inline-block">Employee Name:</span> {payroll.user?.name || 'Unknown'}</p>
          <p><span className="font-semibold w-32 inline-block">Employee Email:</span> {payroll.user?.email || 'N/A'}</p>
        </div>
        <div className="space-y-1">
          <p><span className="font-semibold w-32 inline-block">Payslip Date:</span> {format(new Date(payroll.createdAt), 'MMM dd, yyyy')}</p>
          <p><span className="font-semibold w-32 inline-block">Status:</span> <span className="uppercase text-green-600 font-bold">{payroll.status}</span></p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-0 border border-gray-300 mb-8 rounded overflow-hidden">
        {/* Earnings */}
        <div className="border-r border-gray-300">
          <div className="bg-gray-100 font-bold p-2 border-b border-gray-300 uppercase text-sm tracking-wider">Earnings</div>
          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Basic Salary</span>
              <span className="font-semibold">₹{Number(payroll.basicSalary).toLocaleString()}</span>
            </div>
            {Object.entries(payroll.allowances || {}).map(([key, val]: any) => (
              <div key={key} className="flex justify-between">
                <span className="capitalize">{key}</span>
                <span className="font-semibold">₹{Number(val).toLocaleString()}</span>
              </div>
            ))}
            {payroll.bonus > 0 && (
              <div className="flex justify-between">
                <span>Bonus</span>
                <span className="font-semibold">₹{Number(payroll.bonus).toLocaleString()}</span>
              </div>
            )}
            {payroll.overtime > 0 && (
              <div className="flex justify-between">
                <span>Overtime</span>
                <span className="font-semibold">₹{Number(payroll.overtime).toLocaleString()}</span>
              </div>
            )}
          </div>
          <div className="bg-gray-50 font-bold p-2 px-4 border-t border-gray-300 flex justify-between text-sm">
            <span>Total Earnings</span>
            <span className="text-green-700">₹{Number(payroll.grossSalary).toLocaleString()}</span>
          </div>
        </div>

        {/* Deductions */}
        <div className="flex flex-col">
          <div className="bg-gray-100 font-bold p-2 border-b border-gray-300 uppercase text-sm tracking-wider">Deductions</div>
          <div className="p-4 space-y-2 text-sm flex-grow">
            {Object.entries(payroll.deductions || {}).map(([key, val]: any) => (
              <div key={key} className="flex justify-between">
                <span className="capitalize">{key === 'pf' ? 'Provident Fund (PF)' : key === 'tax' ? 'Income Tax / TDS' : key}</span>
                <span className="font-semibold text-red-600">-₹{Number(val).toLocaleString()}</span>
              </div>
            ))}
            {Object.keys(payroll.deductions || {}).length === 0 && (
              <div className="text-gray-400 italic">No deductions</div>
            )}
          </div>
          <div className="bg-gray-50 font-bold p-2 px-4 border-t border-gray-300 flex justify-between text-sm mt-auto">
            <span>Total Deductions</span>
            <span className="text-red-700">-₹{Number(totalDeductions).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="bg-primary/10 border-l-4 border-primary p-4 rounded mb-10 flex justify-between items-center">
        <span className="text-lg font-bold text-gray-800">NET PAY</span>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary tracking-tight">₹{Number(payroll.netSalary).toLocaleString()}</p>
        </div>
      </div>

      <div className="mt-16 pt-6 border-t border-gray-200 text-center text-sm text-gray-500">
        <p>This is a computer-generated document and does not require a signature.</p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import Layout from '../../components/Layout';
import { useAuth } from '../../context/AuthContext';
import { getMarksByStudent } from '../../firebase/firestore';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export default function StudentMarks() {
  const { currentUser } = useAuth();
  const [marks, setMarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid) return;
    getMarksByStudent(currentUser.uid).then((data) => {
      setMarks(data);
      setLoading(false);
    });
  }, [currentUser]);

  const getGrade = (total, max = 30) => {
    const pct = (total / max) * 100;
    if (pct >= 90) return { grade: 'O', color: '#28a745' };
    if (pct >= 75) return { grade: 'A+', color: '#20c997' };
    if (pct >= 60) return { grade: 'A', color: '#17a2b8' };
    if (pct >= 50) return { grade: 'B', color: '#ffc107' };
    return { grade: 'C', color: '#dc3545' };
  };

  const chartData = {
    labels: marks.map((m) => m.subject),
    datasets: [
      {
        label: 'Test 1 (10)',
        data: marks.map((m) => m.test1 || 0),
        backgroundColor: '#4f6ef7',
        borderRadius: 4,
      },
      {
        label: 'Test 2 (10)',
        data: marks.map((m) => m.test2 || 0),
        backgroundColor: '#17a2b8',
        borderRadius: 4,
      },
      {
        label: 'Assignment (10)',
        data: marks.map((m) => m.assignment || 0),
        backgroundColor: '#28a745',
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { position: 'top' } },
    scales: {
      y: { beginAtZero: true, max: 10, ticks: { stepSize: 2 } },
    },
  };

  return (
    <Layout pageTitle="Internal Marks">
      <h1 className="page-title">Internal Marks</h1>
      <p className="page-subtitle">View your performance across all subjects</p>

      {loading ? (
        <div className="loader-container" style={{ minHeight: 200 }}><div className="loader" /></div>
      ) : marks.length === 0 ? (
        <div className="empty-state"><div className="empty-icon">📊</div><p>No marks records found.</p></div>
      ) : (
        <>
          {/* Table */}
          <div className="card mb-24">
            <h3 className="mb-16">Marks Summary</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Test 1 /10</th>
                    <th>Test 2 /10</th>
                    <th>Assignment /10</th>
                    <th>Total /30</th>
                    <th>Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.map((m) => {
                    const total = (m.test1 || 0) + (m.test2 || 0) + (m.assignment || 0);
                    const { grade, color } = getGrade(total);
                    return (
                      <tr key={m.id}>
                        <td className="font-semibold">{m.subject}</td>
                        <td>{m.test1 ?? '—'}</td>
                        <td>{m.test2 ?? '—'}</td>
                        <td>{m.assignment ?? '—'}</td>
                        <td className="font-bold">{total}</td>
                        <td>
                          <span className="badge" style={{ background: `${color}22`, color }}>
                            {grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Chart */}
          <div className="card">
            <h3 className="mb-16">Performance Chart</h3>
            <div className="chart-wrapper">
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>
        </>
      )}
    </Layout>
  );
}

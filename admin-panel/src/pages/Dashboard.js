import React, { useEffect, useState } from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import PeopleIcon from '@mui/icons-material/People';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import api from '../services/api';
import StatCard from '../components/StatCard';
import RealtimeMap from '../components/RealtimeMap';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function Dashboard() {
  const [stats, setStats] = useState({
    activeRides: 0,
    onlineDrivers: 0,
    todayRevenue: 0,
    todayRides: 0
  });
  const [rideData, setRideData] = useState([]);
  const [statusData, setStatusData] = useState([]);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000); // Atualiza a cada 5s
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await api.get('/analytics/dashboard/realtime');
      setStats(response.data);

      // Dados mockados para gráfico - em produção viriam da API
      setRideData([
        { time: '00:00', rides: 12 },
        { time: '04:00', rides: 8 },
        { time: '08:00', rides: 45 },
        { time: '12:00', rides: 38 },
        { time: '16:00', rides: 52 },
        { time: '20:00', rides: 67 },
      ]);

      setStatusData([
        { name: 'Completadas', value: response.data.today_rides?.completed || 0 },
        { name: 'Canceladas', value: response.data.today_rides?.cancelled || 0 },
        { name: 'Em andamento', value: response.data.active_rides || 0 },
      ]);
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard em Tempo Real
      </Typography>

      <Grid container spacing={3}>
        {/* Cards de estatísticas */}
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Corridas Ativas"
            value={stats.active_rides}
            icon={<DirectionsCarIcon />}
            color="#2196f3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Motoristas Online"
            value={stats.online_drivers}
            icon={<PeopleIcon />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Receita Hoje"
            value={`R$ ${stats.today_revenue?.toFixed(2) || '0.00'}`}
            icon={<AttachMoneyIcon />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Taxa de Conclusão"
            value={stats.today_rides?.completion_rate || '0%'}
            icon={<TrendingUpIcon />}
            color="#9c27b0"
          />
        </Grid>

        {/* Mapa em tempo real */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Mapa em Tempo Real
            </Typography>
            <RealtimeMap />
          </Paper>
        </Grid>

        {/* Gráfico de status */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2, height: 400 }}>
            <Typography variant="h6" gutterBottom>
              Status das Corridas
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Gráfico de corridas por hora */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Corridas nas Últimas 24h
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rideData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="rides" 
                  stroke="#8884d8" 
                  activeDot={{ r: 8 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
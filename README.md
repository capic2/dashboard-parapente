# 🪂 Dashboard Parapente

**Personal paragliding weather dashboard combining real-time conditions from multiple sources with flight analytics.**

[![Status](https://img.shields.io/badge/status-production--ready-success)](https://github.com/yourusername/dashboard-parapente)
[![Python](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/downloads/)
[![React](https://img.shields.io/badge/react-18-blue.svg)](https://reactjs.org/)
[![License](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE)

---

## 🚀 Quick Links

| Guide | Description |
|-------|-------------|
| **[📘 Development Guide](DEVELOPMENT.md)** | Start coding in 5 minutes with FakeRedis |
| **[🚢 Deployment Guide](DEPLOYMENT.md)** | Production deployment with Portainer |
| **[📖 User Guide](USER_GUIDE.md)** | How to use the dashboard |
| **[🤝 Contributing](CONTRIBUTING.md)** | Join the project |
| **[🏗️ Architecture](docs/ARCHITECTURE.md)** | Technical deep dive |
| **[📡 API Reference](docs/API.md)** | REST API documentation |

---

## ✨ Features

### Weather & Forecasting
- **🌤️ Multi-Source Aggregation**: Data from 8 weather providers
- **🎯 Para-Index Score**: 0-100 composite flying conditions
- **📊 7-Day Forecast**: Hourly granularity with consensus algorithm
- **🔄 Real-time Updates**: Automated polling every 30 minutes
- **💨 Wind Analysis**: Direction matching with site orientation

### Flight Tracking
- **✈️ Flight History**: Log and analyze your flights
- **📈 Statistics Dashboard**: Total flights, hours, distance
- **📍 Multi-Site Support**: Track multiple takeoff locations
- **📄 GPX Export**: Download flight tracks

### Intelligence
- **🏆 Best Spot Recommendation**: AI suggests optimal flying location
- **🔔 Smart Alerts**: Notifications when conditions are perfect (coming soon)
- **📉 Source Comparison**: See which provider is most accurate

---

## 🎯 Quick Start

### Development (Local)

```bash
# Clone repository
git clone <your-repo-url>
cd dashboard-parapente

# Backend (Terminal 1)
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python init_db.py
python -m uvicorn main:app --reload

# Frontend (Terminal 2)
cd frontend
npm install
npm run dev
```

**Visit:** http://localhost:5173

**No Redis server needed!** FakeRedis is used automatically in development.

📚 **Full guide:** [DEVELOPMENT.md](DEVELOPMENT.md)

### Production (Portainer)

1. Import `docker-compose.yml` as a stack
2. Set environment variables (API keys)
3. Deploy

**Redis server required** for production caching.

📚 **Full guide:** [DEPLOYMENT.md](DEPLOYMENT.md)

---

## 🏗️ Tech Stack

### Backend
- **Python 3.10+** - Core language
- **FastAPI** - REST API framework
- **SQLAlchemy** - ORM
- **Redis / FakeRedis** - Caching layer
- **APScheduler** - Background jobs

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **TanStack Query** - Data fetching
- **Tailwind CSS** - Styling
- **Vite** - Build tool

### Infrastructure
- **Docker** - Containerization
- **Portainer** - Container management
- **SQLite** - Database (upgradeable to PostgreSQL)
- **Nginx** - Reverse proxy (optional)

---

## 📸 Screenshots

### Dashboard
![Dashboard Overview](docs/images/dashboard-overview.png)
*Main dashboard with Para-Index, current conditions, and 7-day forecast*

### Site Selector
![Site Selector](docs/images/site-selector.png)
*Multi-orientation site selector with wind indicators*

### Flight History
![Flight History](docs/images/flight-history.png)
*Flight log with statistics and altitude chart*

---

## 🌍 Weather Sources

Data aggregated from:

1. **Open-Meteo** - Open-source weather API
2. **WeatherAPI** - Global weather data
3. **Meteoblue** - High-resolution forecasts
4. **Météo-parapente** - Paragliding-specific
5. **Météociel** - French regional data
6. **Windy** - Wind visualization
7. **Paragliding.net** - Community forecasts
8. **Planète-voile** - Local conditions

**Consensus algorithm** calculates median values across sources and flags outliers.

---

## 📁 Project Structure

```
dashboard-parapente/
├── backend/              # Python FastAPI backend
│   ├── cache.py         # Redis/FakeRedis cache
│   ├── main.py          # App entry point
│   ├── routes.py        # API endpoints
│   ├── scheduler.py     # Weather polling
│   ├── weather_pipeline.py  # Data aggregation
│   └── scrapers/        # Weather sources
├── frontend/            # React TypeScript frontend
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── pages/       # Page components
│   │   ├── hooks/       # Custom hooks
│   │   └── types/       # TypeScript types
├── docs/                # Documentation
│   ├── ARCHITECTURE.md  # Technical architecture
│   ├── API.md          # API reference
│   └── PHASE-1-DESIGN/ # Original design docs
├── DEVELOPMENT.md       # Dev setup guide
├── DEPLOYMENT.md        # Production deployment
├── USER_GUIDE.md        # User manual
└── CONTRIBUTING.md      # Contribution guidelines
```

---

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
cd frontend
npm run test

# Type checking
npm run type-check

# Linting
flake8 .           # Python
npm run lint       # TypeScript
```

---

## 📊 Performance

| Metric | Development | Production |
|--------|-------------|------------|
| **API Response Time** | 10-50 ms | 20-100 ms |
| **Cache Hit Rate** | 95%+ | 98%+ |
| **Weather Refresh** | Every 30 min | Every 30 min |
| **Concurrent Users** | 10+ | 100+ (scalable) |

---

## 🔐 Security

- ✅ API keys in environment variables (never committed)
- ✅ HTTPS enforced in production
- ✅ Input validation on all endpoints
- ✅ CORS properly configured
- ✅ Rate limiting enabled
- ✅ SQL injection prevention (SQLAlchemy ORM)
- ✅ XSS protection (React escaping)

See [DEPLOYMENT.md](DEPLOYMENT.md) for security best practices.

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Code style guidelines
- Testing requirements
- Pull request process
- Community guidelines

**Quick contribution:**
1. Fork the repo
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open Pull Request

---

## 📝 Changelog

See [CHANGELOG.md](docs/archive/CHANGELOG.md) for version history.

**Latest:** v1.0.0 (March 2026)
- ✅ Complete weather aggregation system
- ✅ Multi-source consensus algorithm
- ✅ Para-Index calculation
- ✅ Flight tracking
- ✅ Multi-site support with orientations
- ✅ FakeRedis for development
- ✅ Production-ready deployment

---

## 📄 License

BSD-3-Clause License - see [LICENSE](LICENSE) file for details.

**TLDR:** Free to use, modify, and distribute with attribution.

---

## 🙏 Acknowledgments

- Weather data providers (Open-Meteo, WeatherAPI, Meteoblue, etc.)
- Paragliding community for domain expertise
- FastAPI and React communities for excellent tooling

---

## 📞 Support

- **Documentation**: Check guides above (DEVELOPMENT.md, etc.)
- **Issues**: [Open an issue](https://github.com/yourusername/dashboard-parapente/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/dashboard-parapente/discussions)
- **Email**: your-email@example.com

---

## 🗺️ Roadmap

### ✅ Completed
- Multi-source weather aggregation
- Para-Index algorithm
- Flight tracking
- Multi-site support
- Generic multi-orientation selector
- FakeRedis development mode

### 🚧 In Progress
- User authentication
- Alert system (Telegram notifications)

### 📅 Planned
- Mobile app (React Native)
- Predictive analytics (best days to fly)
- Real-time updates (WebSocket)
- Community features (ratings, comments)
- Flight planning tools

---

**Built with ❤️ for the paragliding community | Safe flights! 🪂**

---

**Last updated:** March 3, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅

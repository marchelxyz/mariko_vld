import { useState, useEffect } from "react";
import {
  Users,
  Search,
  Download,
  Upload,
  BarChart3,
  Calendar,
  UserCheck,
  Gift,
  ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { BottomNavigation } from "@/components/BottomNavigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  profileDB,
  prepareDatabaseMigration,
  type UserProfile,
} from "@/lib/database";

const AdminPanel = () => {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [stats, setStats] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const allProfiles = profileDB.getAllProfiles();
    setProfiles(allProfiles);
    setStats(profileDB.getStats());
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      const results = profileDB.searchProfiles(query);
      setProfiles(results);
    } else {
      setProfiles(profileDB.getAllProfiles());
    }
  };

  const exportData = () => {
    const data = prepareDatabaseMigration();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mariko_users_${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  const addBonusPoints = (userId: string, points: number) => {
    const profile = profileDB.getProfile(userId);
    if (profile) {
      profileDB.updateProfile(userId, {
        bonusPoints: profile.bonusPoints + points,
      });
      loadData();
    }
  };

  return (
    <div className="min-h-screen bg-mariko-primary overflow-hidden flex flex-col">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex-1 px-4 md:px-6 max-w-6xl mx-auto w-full">
        {/* Back Button and Title */}
        <div className="mt-8 flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate("/")}
            className="p-2 text-white hover:bg-white/10 rounded-full transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-el-messiri text-3xl md:text-4xl font-bold">
            Админ панель
          </h1>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-mariko-secondary rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Users className="w-6 h-6 text-white" />
                <div>
                  <div className="text-white font-el-messiri text-2xl font-bold">
                    {stats.totalUsers}
                  </div>
                  <div className="text-white/60 text-sm">
                    Всего пользователей
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-mariko-secondary rounded-lg p-4">
              <div className="flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-green-400" />
                <div>
                  <div className="text-white font-el-messiri text-2xl font-bold">
                    {stats.activeThisWeek}
                  </div>
                  <div className="text-white/60 text-sm">
                    Активных за неделю
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-mariko-secondary rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Gift className="w-6 h-6 text-yellow-400" />
                <div>
                  <div className="text-white font-el-messiri text-2xl font-bold">
                    {stats.totalBonusPoints}
                  </div>
                  <div className="text-white/60 text-sm">Бонусных баллов</div>
                </div>
              </div>
            </div>

            <div className="bg-mariko-secondary rounded-lg p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-6 h-6 text-blue-400" />
                <div>
                  <div className="text-white font-el-messiri text-sm">
                    М: {stats.genderDistribution.male} Ж:{" "}
                    {stats.genderDistribution.female}
                  </div>
                  <div className="text-white/60 text-sm">Распределение</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search and Export */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/60" />
            <Input
              type="text"
              placeholder="Поиск по имени, телефону или ID..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-mariko-secondary border-white/20 text-white placeholder-white/60"
            />
          </div>
          <Button
            onClick={exportData}
            className="bg-green-600 hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
        </div>

        {/* Users List */}
        <div className="bg-mariko-secondary rounded-lg overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="border-b border-white/10 p-4 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <img
                      src={profile.photo}
                      alt={profile.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <div>
                      <div className="text-white font-el-messiri font-semibold">
                        {profile.name}
                      </div>
                      <div className="text-white/60 text-sm">
                        {profile.phone || "Телефон не указан"}
                      </div>
                      <div className="text-white/40 text-xs">
                        ID: {profile.id}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-white font-el-messiri font-bold">
                      {profile.bonusPoints} баллов
                    </div>
                    <div className="text-white/60 text-sm">
                      {profile.gender}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Button
                        size="sm"
                        onClick={() => addBonusPoints(profile.id, 100)}
                        className="bg-yellow-600 hover:bg-yellow-700 text-xs"
                      >
                        +100
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => setSelectedUser(profile)}
                        variant="outline"
                        className="border-white/20 text-white text-xs"
                      >
                        Детали
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* User Details Modal */}
        {selectedUser && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-mariko-secondary rounded-lg p-6 max-w-md w-full max-h-96 overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-el-messiri text-xl font-bold">
                  Детали пользователя
                </h3>
                <Button
                  variant="ghost"
                  onClick={() => setSelectedUser(null)}
                  className="text-white"
                >
                  ✕
                </Button>
              </div>

              <div className="space-y-3 text-white">
                <div>
                  <strong>Имя:</strong> {selectedUser.name}
                </div>
                <div>
                  <strong>Телефон:</strong> {selectedUser.phone || "Не указан"}
                </div>
                <div>
                  <strong>Дата рождения:</strong>{" "}
                  {selectedUser.birthDate || "Не указана"}
                </div>
                <div>
                  <strong>Пол:</strong> {selectedUser.gender}
                </div>
                <div>
                  <strong>Бонусные баллы:</strong> {selectedUser.bonusPoints}
                </div>
                <div>
                  <strong>Уведомления:</strong>{" "}
                  {selectedUser.notificationsEnabled ? "Включены" : "Отключены"}
                </div>
                <div>
                  <strong>Ресторан:</strong> {selectedUser.selectedRestaurant}
                </div>
                <div>
                  <strong>Регистрация:</strong>{" "}
                  {new Date(selectedUser.createdAt).toLocaleDateString("ru-RU")}
                </div>
                <div>
                  <strong>Последний вход:</strong>{" "}
                  {new Date(selectedUser.lastLogin).toLocaleDateString("ru-RU")}
                </div>

                {/* Activity */}
                <div className="mt-4">
                  <strong>Активность:</strong>
                  <div className="max-h-32 overflow-y-auto mt-2 text-sm">
                    {profileDB
                      .getUserActivity(selectedUser.id)
                      .slice(0, 5)
                      .map((activity) => (
                        <div key={activity.id} className="py-1">
                          {activity.action} -{" "}
                          {new Date(activity.timestamp).toLocaleString("ru-RU")}
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation currentPage="home" />
    </div>
  );
};

export default AdminPanel;

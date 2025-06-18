#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🤖 Запускник ТОЛЬКО Telegram бота для Хачапури Марико
Простой Python скрипт для запуска Node.js бота.
Мини-приложение уже развернуто на Netlify.
"""

import os
import sys
import subprocess
import time
from pathlib import Path

# Цвета для красивого вывода
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'

def print_logo():
    """Красивое лого"""
    print(f"{Colors.PURPLE}{Colors.BOLD}")
    print("╔═══════════════════════════════════════════════════════════╗")
    print("║                    🇬🇪 ХАЧАПУРИ МАРИКО 🇬🇪                   ║")
    print("║                    Telegram Bot ONLY Launcher            ║")
    print("║               (Приложение уже на Netlify)                ║")
    print("╚═══════════════════════════════════════════════════════════╝")
    print(f"{Colors.END}")

def check_requirements():
    """Проверка требований для запуска бота"""
    print(f"{Colors.CYAN}🔍 Проверка требований для бота...{Colors.END}")
    
    # Проверка Node.js
    try:
        result = subprocess.run(['node', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"{Colors.GREEN}✅ Node.js: {version}{Colors.END}")
        else:
            print(f"{Colors.RED}❌ Node.js не найден!{Colors.END}")
            return False
    except FileNotFoundError:
        print(f"{Colors.RED}❌ Node.js не установлен!{Colors.END}")
        return False
    
    # Проверка npm
    try:
        result = subprocess.run(['npm', '--version'], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.strip()
            print(f"{Colors.GREEN}✅ npm: {version}{Colors.END}")
        else:
            print(f"{Colors.RED}❌ npm не найден!{Colors.END}")
            return False
    except FileNotFoundError:
        print(f"{Colors.RED}❌ npm не установлен!{Colors.END}")
        return False
    
    # Проверка что мы в папке бота
    current_dir = Path.cwd()
    if not (current_dir / 'package.json').exists():
        print(f"{Colors.RED}❌ Файл package.json не найден!{Colors.END}")
        print(f"{Colors.YELLOW}💡 Убедитесь что вы запускаете скрипт из папки bot/{Colors.END}")
        return False
    
    print(f"{Colors.GREEN}✅ Папка бота найдена{Colors.END}")
    return True

def setup_environment():
    """Настройка окружения для бота"""
    print(f"{Colors.YELLOW}⚙️  Настройка окружения для бота...{Colors.END}")
    
    env_file = Path('.env')
    env_example = Path('env.example')
    
    # Создаем .env если его нет
    if not env_file.exists() and env_example.exists():
        print(f"{Colors.YELLOW}📝 Создание файла .env для бота...{Colors.END}")
        
        # Копируем из примера
        with open(env_example, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Заменяем значения по умолчанию для Netlify
        content = content.replace(
            'WEBAPP_URL=https://your-domain.com',
            'WEBAPP_URL=https://hachapurimariko.netlify.app'
        )
        content = content.replace(
            'NODE_ENV=development',
            'NODE_ENV=production'
        )
        
        # УБИРАЕМ WEBHOOK_URL чтобы бот работал в polling режиме
        lines = content.split('\n')
        filtered_lines = []
        for line in lines:
            if not line.startswith('WEBHOOK_URL=') and not line.startswith('WEBHOOK_SECRET='):
                filtered_lines.append(line)
        content = '\n'.join(filtered_lines)
        
        # Добавляем комментарий о режиме polling
        content += '\n\n# Polling режим (без webhook)\n# WEBHOOK_URL не указан - бот работает в polling режиме для разработки\n'
        
        with open(env_file, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"{Colors.GREEN}✅ Файл .env создан с URL Netlify (polling режим){Colors.END}")
        print(f"{Colors.BLUE}🔄 Бот будет работать в polling режиме (без localhost сервера){Colors.END}")
        print(f"{Colors.YELLOW}⚠️  Не забудьте добавить ваш BOT_TOKEN от @BotFather!{Colors.END}")
    
    # Если .env уже существует, проверяем и исправляем его
    elif env_file.exists():
        print(f"{Colors.CYAN}📋 Проверка существующего .env файла...{Colors.END}")
        
        with open(env_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Проверяем наличие WEBHOOK_URL
        if 'WEBHOOK_URL=' in content:
            print(f"{Colors.YELLOW}🔧 Найден WEBHOOK_URL в .env - удаляю для polling режима...{Colors.END}")
            
            # Убираем строки с WEBHOOK
            lines = content.split('\n')
            filtered_lines = []
            for line in lines:
                if not line.startswith('WEBHOOK_URL=') and not line.startswith('WEBHOOK_SECRET='):
                    filtered_lines.append(line)
            
            # Добавляем комментарий если его нет
            content = '\n'.join(filtered_lines)
            if '# Polling режим' not in content:
                content += '\n\n# Polling режим (без webhook)\n# WEBHOOK_URL не указан - бот работает в polling режиме для разработки\n'
            
            with open(env_file, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"{Colors.GREEN}✅ .env файл исправлен - убран WEBHOOK_URL{Colors.END}")
            print(f"{Colors.BLUE}🔄 Теперь бот будет работать в polling режиме{Colors.END}")
        else:
            print(f"{Colors.GREEN}✅ .env файл уже настроен для polling режима{Colors.END}")
    
    # Проверяем наличие BOT_TOKEN
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            env_content = f.read()
            if 'BOT_TOKEN=your_bot_token_here' in env_content:
                print(f"{Colors.RED}⚠️  ВНИМАНИЕ: Нужно настроить BOT_TOKEN в файле .env{Colors.END}")
                return False
    
    return True

def install_dependencies():
    """Установка зависимостей для бота"""
    print(f"{Colors.YELLOW}📦 Установка зависимостей для бота...{Colors.END}")
    
    try:
        # Проверяем наличие node_modules
        if not Path('./node_modules').exists():
            print(f"{Colors.YELLOW}📥 Установка npm пакетов для бота...{Colors.END}")
            result = subprocess.run(['npm', 'install'], check=True)
            print(f"{Colors.GREEN}✅ Зависимости бота установлены{Colors.END}")
        else:
            print(f"{Colors.GREEN}✅ Зависимости бота уже установлены{Colors.END}")
            
        return True
    except subprocess.CalledProcessError as e:
        print(f"{Colors.RED}❌ Ошибка установки зависимостей: {e}{Colors.END}")
        return False

def build_bot():
    """Сборка TypeScript бота"""
    print(f"{Colors.YELLOW}🔨 Сборка TypeScript кода бота...{Colors.END}")
    
    try:
        result = subprocess.run(['npm', 'run', 'build'], check=True, capture_output=True, text=True)
        print(f"{Colors.GREEN}✅ Сборка бота завершена{Colors.END}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"{Colors.RED}❌ Ошибка сборки бота: {e}{Colors.END}")
        if e.stdout:
            print(f"Вывод: {e.stdout}")
        if e.stderr:
            print(f"Ошибки: {e.stderr}")
        return False

def start_bot():
    """Запуск ТОЛЬКО Telegram бота (не приложения!)"""
    print(f"{Colors.GREEN}{Colors.BOLD}🤖 ЗАПУСК TELEGRAM БОТА...{Colors.END}")
    print(f"{Colors.CYAN}📱 Mini App уже работает: https://hachapurimariko.netlify.app{Colors.END}")
    print(f"{Colors.BLUE}🔧 Запускается только бот (polling режим){Colors.END}")
    print(f"{Colors.PURPLE}📍 Текущая папка: {Path.cwd()}{Colors.END}")
    print(f"{Colors.PURPLE}⚡ Команда: npm run dev{Colors.END}")
    print(f"{Colors.YELLOW}💡 Для остановки бота нажмите Ctrl+C{Colors.END}")
    print("─" * 60)
    
    try:
        # Показываем что именно в package.json
        print(f"{Colors.CYAN}🔍 Проверяю команду dev в package.json...{Colors.END}")
        with open('package.json', 'r') as f:
            import json
            pkg = json.load(f)
            dev_script = pkg.get('scripts', {}).get('dev', 'НЕ НАЙДЕНО')
            print(f"{Colors.BLUE}📋 npm run dev = {dev_script}{Colors.END}")
        
        print(f"{Colors.GREEN}🚀 Запускаю: {dev_script}{Colors.END}")
        print("─" * 60)
        
        # Запускаем ТОЛЬКО бота в режиме разработки (polling)
        subprocess.run(['npm', 'run', 'dev'], check=True)
    except subprocess.CalledProcessError as e:
        print(f"{Colors.RED}❌ Ошибка запуска бота: {e}{Colors.END}")
        return False
    except KeyboardInterrupt:
        print(f"\n{Colors.YELLOW}🛑 Telegram бот остановлен пользователем{Colors.END}")
        return True

def main():
    """Главная функция - запуск ТОЛЬКО бота"""
    print_logo()
    print(f"{Colors.BLUE}ℹ️  Этот скрипт запускает ТОЛЬКО Telegram бота.{Colors.END}")
    print(f"{Colors.BLUE}ℹ️  Мини-приложение уже развернуто на Netlify.{Colors.END}")
    print()
    
    # КРИТИЧЕСКИ ВАЖНО: убедимся что мы в папке bot
    current_dir = Path.cwd()
    
    # Если мы НЕ в папке bot, но видим папку bot рядом
    if current_dir.name != 'bot' and (current_dir / 'bot').exists():
        print(f"{Colors.YELLOW}🔄 Обнаружено: скрипт запущен из корня проекта{Colors.END}")
        print(f"{Colors.YELLOW}📁 Автоматически перехожу в папку bot/...{Colors.END}")
        os.chdir('bot')
        print(f"{Colors.GREEN}✅ Теперь в папке: {Path.cwd()}{Colors.END}")
        print()
    
    # Если мы все еще НЕ в папке bot
    if not (Path.cwd() / 'package.json').exists() or Path.cwd().name != 'bot':
        print(f"{Colors.RED}❌ ОШИБКА: Неправильная папка!{Colors.END}")
        print(f"{Colors.YELLOW}📍 Текущая папка: {Path.cwd()}{Colors.END}")
        print(f"{Colors.YELLOW}💡 Нужно запускать из папки bot/ или рядом с ней{Colors.END}")
        sys.exit(1)
    
    # Проверка требований
    if not check_requirements():
        print(f"\n{Colors.RED}❌ Проверка не пройдена. Установите требования и попробуйте снова.{Colors.END}")
        sys.exit(1)
    
    # Настройка окружения
    if not setup_environment():
        print(f"\n{Colors.RED}❌ Настройте BOT_TOKEN в файле .env и запустите снова.{Colors.END}")
        print(f"{Colors.CYAN}💡 Получить токен: https://t.me/BotFather{Colors.END}")
        sys.exit(1)
    
    # Установка зависимостей
    if not install_dependencies():
        print(f"\n{Colors.RED}❌ Не удалось установить зависимости.{Colors.END}")
        sys.exit(1)
    
    # Сборка
    if not build_bot():
        print(f"\n{Colors.RED}❌ Не удалось собрать проект.{Colors.END}")
        sys.exit(1)
    
    # Запуск
    print(f"\n{Colors.GREEN}✅ Все готово к запуску бота!{Colors.END}")
    time.sleep(1)
    
    start_bot()

if __name__ == "__main__":
    main() 
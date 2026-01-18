# SEO აუდიტი - Next.js

ვებგვერდის SEO ანალიზის ინსტრუმენტი 50+ შემოწმებით.

## ფუნქციები

- ✅ სათაური, მეტა აღწერა, H1-H6
- ✅ სურათების alt ტექსტი
- ✅ ბმულების ანალიზი (შიდა, გარე, გატეხილი)
- ✅ Schema.org მარკაპი
- ✅ Open Graph & Twitter Cards
- ✅ ხელმისაწვდომობა (Accessibility)
- ✅ CMS და Framework-ების აღმოჩენა
- ✅ JSON/CSV ექსპორტი

---

## ინსტალაცია სერვერზე

### 1. ფაილების ატვირთვა

```bash
# შექმენით საქაღალდე
sudo mkdir -p /var/www/seo-audit

# ატვირთეთ ფაილები (scp, rsync, ან git)
scp -r ./* user@server:/var/www/seo-audit/
```

### 2. დამოკიდებულებების ინსტალაცია

```bash
cd /var/www/seo-audit
npm install
```

### 3. აწყობა (Build)

```bash
npm run build
```

### 4. PM2-ით გაშვება

```bash
# PM2 ინსტალაცია (თუ არ არის)
sudo npm install -g pm2

# გაშვება
pm2 start npm --name "seo-audit" -- start

# ავტო-გაშვება სერვერის რესტარტისას
pm2 save
pm2 startup
```

### 5. Apache კონფიგურაცია

შექმენით `/etc/apache2/sites-available/seo-audit.conf`:

```apache
<VirtualHost *:80>
    ServerName seo.yourdomain.com
    
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
    
    ErrorLog ${APACHE_LOG_DIR}/seo-audit-error.log
    CustomLog ${APACHE_LOG_DIR}/seo-audit-access.log combined
</VirtualHost>
```

### 6. Apache მოდულების ჩართვა

```bash
sudo a2enmod proxy proxy_http
sudo a2ensite seo-audit
sudo systemctl restart apache2
```

---

## HTTPS (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d seo.yourdomain.com
```

---

## სტრუქტურა

```
/var/www/seo-audit/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   ├── seochecker/
│   │   └── page.tsx          # მთავარი UI (ქართულად)
│   └── api/
│       └── audit/
│           └── route.ts      # API endpoint
├── lib/
│   ├── audit/
│   │   ├── runAudit.ts       # აუდიტის ლოგიკა
│   │   └── types.ts          # TypeScript ტიპები
│   ├── checks/
│   │   └── patterns.ts       # CMS/Framework patterns
│   └── fetch/
│       └── fetchHtml.ts      # HTML fetch
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
└── postcss.config.js
```

---

## API გამოყენება

### POST /api/audit

```bash
# URL-ით
curl -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com"}'

# HTML-ით
curl -X POST http://localhost:3000/api/audit \
  -H "Content-Type: application/json" \
  -d '{"html": "<!DOCTYPE html>..."}'
```

---

## სასარგებლო ბრძანებები

```bash
# სტატუსი
pm2 status

# ლოგები
pm2 logs seo-audit

# რესტარტი
pm2 restart seo-audit

# გაჩერება
pm2 stop seo-audit
```

---

## პრობლემების გადაჭრა

### "Cannot find module 'jsdom'"
```bash
npm install jsdom @types/jsdom
```

### Port 3000 დაკავებულია
```bash
# შეცვალეთ პორტი package.json-ში
"start": "next start -p 3001"
```

### Apache Proxy არ მუშაობს
```bash
sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

---

## ლიცენზია

MIT

# igCircle Blog Server

一个基于 NestJS 构建的博客系统后端服务，提供完整的博客管理功能和 RESTful API。

## 🚀 项目特性

### 核心功能
- **用户管理系统**：用户注册、登录、权限管理、邮箱验证
- **文章管理**：文章的创建、编辑、发布、归档、批量操作
- **Markdown自动解析**：自动解析Markdown数据，使用 gray-matter 解析 frontmatter
- **分类标签**：文章分类和标签管理
- **评论系统**：支持多级评论、点赞、管理员审核
- **搜索功能**：全文搜索、分类搜索、标签搜索
- **统计分析**：文章浏览量、点赞数、评论数等统计
- **文件上传**：支持markdown、图片等文件上传
- **邮件服务**：验证码发送、密码重置等

### 技术特性
- **现代化架构**：基于 NestJS 框架，采用模块化设计
- **数据库支持**：MySQL 数据库，TypeORM 作为 ORM
- **身份认证**：JWT Token 认证，支持多设备登录管理
- **缓存系统**： 设置缓存，提升性能
- **日志系统**：结构化日志记录，支持文件和控制台输出
- **API 文档**：集成 Swagger 自动生成 API 文档
- **数据验证**：使用 class-validator 进行数据验证
- **错误处理**：统一的异常处理和错误响应
- **安全防护**：CORS 配置、请求频率限制、密码加密

## 🛠 技术栈

### 后端框架
- **NestJS** - 渐进式 Node.js 框架
- **TypeScript** - 类型安全的 JavaScript 超集

### 数据库
- **MySQL 8.0** - 关系型数据库
- **TypeORM** - TypeScript ORM 框架
- **nestjs-cache-manager** - 缓存数据库

### 身份认证
- **JWT** - JSON Web Token 认证
- **bcrypt** - 密码加密

### 工具库
- **class-validator** - 数据验证
- **class-transformer** - 数据转换
- **Swagger** - API 文档生成
- **nodemailer** - 邮件发送
- **multer** - 文件上传
- **gray-matter** - Markdown 文件解析
- **reading-time** - 阅读时间计算

## 📁 项目结构

```
src/
├── app.module.ts              # 应用主模块
├── main.ts                    # 应用入口文件
├── common/                    # 通用模块
│   ├── base/                  # 基础服务类
│   ├── cache/                 # 缓存服务
│   ├── config/                # 配置管理
│   ├── decorators/            # 自定义装饰器
│   ├── exceptions/            # 异常处理
│   ├── filters/               # 异常过滤器
│   ├── interceptors/          # 拦截器
│   ├── logger/                # 日志服务
│   ├── middleware/            # 中间件
│   ├── pipes/                 # 管道
│   └── utils/                 # 工具函数
├── config/                    # 配置文件
│   ├── database.config.ts     # 数据库配置
│   └── jwt.config.ts          # JWT 配置
├── controllers/               # 控制器
│   ├── admin/                 # 管理员接口
│   ├── public/                # 公共接口
│   ├── user/                  # 用户接口
│   └── *.controller.ts        # 其他控制器
├── dto/                       # 数据传输对象
├── entities/                  # 数据库实体
├── enums/                     # 枚举定义
├── guards/                    # 守卫
├── modules/                   # 功能模块
└── services/                  # 业务服务
    ├── article/               # 文章相关服务
    ├── common/                # 通用服务
    └── *.service.ts           # 其他服务
```

## 🚀 快速开始

### 环境要求
- Node.js >= 16.0.0
- MySQL >= 8.0
- pnpm >= 7.0.0

### 安装依赖

```bash
# 克隆项目
git clone https://github.com/IgnorantCircle/igcircle-blog-server
cd igcircle-blog-server

# 安装依赖
pnpm install
```

### 环境配置

1. 复制环境配置文件：
```bash
cp .env.development.local.example .env.development.local
```

2. 修改 `.env.development.local` 配置：
```env
# 应用配置
PORT=7001
NODE_ENV=development

# 数据库配置
DB_HOST=
DB_PORT=3306
DB_USER=root
DB_PASS=your_password
DB_NAME=your_db_name
DB_SYNCHRONIZE=false
DB_LOGGING=true

# JWT配置
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# 邮件服务配置
MAIL_HOST=your_mail_host
MAIL_PORT=465
MAIL_USER=your_email@163.com
MAIL_PASS=your_email_password
MAIL_SECURE=true

# 其他配置...
```

### 数据库设置

#### 使用 Docker（推荐）
```bash
# 启动 MySQL 容器
docker-compose up -d mysql
```

#### 手动安装
1. 安装 MySQL 8.0
2. 创建数据库：

### 运行应用

```bash
# 开发模式
pnpm run start:dev

# 生产模式
pnpm run build
pnpm run start:prod
```

应用将在 `http://localhost:7001` 启动。

## 📚 API 文档

启动应用后，访问 `http://localhost:7001/api-docs` 查看完整的 Swagger API 文档。


## 🔧 开发指南

### 代码规范

项目使用 ESLint 和 Prettier 进行代码规范化：

```bash
# 代码检查
pnpm run lint

# 代码格式化
pnpm run format
```

### 测试

```bash
# 单元测试
pnpm run test

# 测试覆盖率
pnpm run test:cov

# E2E 测试
pnpm run test:e2e
```

### 构建部署

```bash
# 构建项目
pnpm run build

# 生产环境运行
pnpm run start:prod
```

## 🔒 安全特性

- **密码加密**：使用 bcrypt 进行密码哈希
- **JWT 认证**：安全的 Token 认证机制
- **CORS 配置**：跨域请求安全控制
- **请求验证**：严格的输入数据验证
- **SQL 注入防护**：TypeORM 参数化查询
- **XSS 防护**：输入数据清理和转义
- **限流处理**：防止暴力攻击

## 📊 性能优化

- **数据库索引**：关键字段建立索引
- **查询优化**：使用 QueryBuilder 优化复杂查询
- **缓存策略**： 缓存热点数据
- **分页查询**：避免大量数据查询
- **懒加载**：按需加载关联数据
- **连接池**：数据库连接池管理

## 🚀 部署指南

### Docker 部署

```bash
# 构建镜像
docker build -t igcircle-blog-server .

# 运行容器
docker run -p 7001:7001 igcircle-blog-server
```

### PM2 部署

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start dist/main.js --name "blog-server"

# 查看状态
pm2 status

# 查看日志
pm2 logs blog-server
```

## 项目链接

- 用户端：[igcircle-blog-web](https://github.com/IgnorantCircle/igcircle-blog-client)
- 管理端：[igcircle-blog-mobile](https://github.com/IgnorantCircle/igcircle-blog-admin)
- 服务端：[igcircle-blog-mobile](https://github.com/IgnorantCircle/igcircle-blog-server)

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 UNLICENSED 许可证。

## 📞 联系方式

如有问题或建议，请通过以下方式联系：

- 项目 Issues: [GitHub Issues]()
- 邮箱: igcircle@163.com

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和开源社区。

---

**注意**：这是一个开发中的项目，部分功能可能还在完善中。欢迎提出建议和贡献代码！

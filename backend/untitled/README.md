# 计划
## 功能需求列表: 
### Pure 后端(包含和terminal交互)
1. 用户管理:
    * 用户注册、登录、注销
    * 个人资料管理 
    * 角色分类(游客、注册用户、管理员)
2. 课程管理:
   * 课程列表展示
   * 课程详情页
   * 课程搜索和筛选(按学科、难度等)
   * 管理员可创建、编辑、删除课程
3. 评价系统:
   * 注册用户可对课程进行评价和打分
   * 评价包含文字评论和星级评分
   * 课程页面显示平均评分和评价列表
   * 用户可编辑或删除自己的评价
   * 游客可查看评价，但不能评价
4. 资源共享:
   * 注册用户可上传课程相关资源(讲义、作业等)
   * 资源分类管理
   * 资源下载功能(游客可预览，注册用户可下载)
   * 资源搜索功能
5. 管理功能:
   * 管理员可管理所有用户、课程、评价和资源
   * 内容审核功能 
### Dirty 后端(数据库相关)
1. 用户表(Users):
   * `id`: 主键
   * `username`: 用户名
   * `email`: 邮箱
   * `password`: 密码(加密存储)
   * `role`: 角色(用户/管理员)
   * `created_at`: 创建时间
   * `updated_at`: 更新时间
2. 课程表(Courses):
   * `id`: 主键
   * `title`: 课程名称
   * `description`: 课程描述
   * `subject`: 学科
   * `difficulty`: 难度
   * `created_at`: 创建时间
   * `updated_at`: 更新时间
3. 评价表(Reviews):
   * `id`: 主键
   * `course_id`: 外键(关联Courses表)
   * `user_id`: 外键(关联Users表)
   * `content`: 评价内容
   * `rating`: 评分
   * `created_at`: 创建时间
   * `updated_at`: 更新时间
4. 资源表(Resources):
   * `id`: 主键
   * `course_id`: 外键(关联Courses表)
   * `user_id`: 外键(关联Users表)
   * `title`: 资源标题
   * `description`: 资源描述
   * `file_path`: 文件路径
   * `file_type`: 文件类型
   * `created_at`: 创建时间
   * `updated_at`: 更新时间
### API接口规范: 
1. 用户相关:
   * `POST /api/users/register`: 用户注册
   * `POST /api/users/login`: 用户登录
   * `GET /api/users/profile`: 获取用户资料
   * `PUT /api/users/profile`: 更新用户资料
2. 课程相关:
   * `GET /api/courses`: 获取课程列表
   * `GET /api/courses/:id`: 获取课程详情
   * `POST /api/courses`: 创建新课程(仅管理员)
   * `PUT /api/courses/:id`: 更新课程信息(仅管理员)
   * `DELETE /api/courses/:id`: 删除课程(仅管理员)
3. 评价相关:
   * `GET /api/courses/:id/reviews`: 获取课程评价
   * `POST /api/courses/:id/reviews`: 添加课程评价(仅注册用户)
   * `PUT /api/reviews/:id`: 更新评价(仅评价作者或管理员)
   * `DELETE /api/reviews/:id`: 删除评价(仅评价作者或管理员)
4. 资源相关:
    - `GET /api/courses/:id/resources`: 获取课程资源
    - `POST /api/courses/:id/resources`: 上传课程资源(仅注册用户)
    - `GET /api/resources/:id`: 下载资源(仅注册用户)
    - `DELETE /api/resources/:id`: 删除资源(仅上传者或管理员)

5. 管理相关:
    - `GET /api/admin/users`: 获取所有用户列表(仅管理员)
    - `PUT /api/admin/users/:id`: 更新用户信息(仅管理员)
    - `DELETE /api/admin/users/:id`: 删除用户(仅管理员)
    - `GET /api/admin/reviews`: 获取所有评价列表(仅管理员)
    - `PUT /api/admin/reviews/:id`: 审核/更新评价(仅管理员)
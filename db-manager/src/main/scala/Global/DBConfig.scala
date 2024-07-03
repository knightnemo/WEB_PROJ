package Global

case class DBConfig(
                     /** 数据库地址，例如：jdbc:postgresql://localhost:5432/db */
                     jdbcUrl: String,

                     /** 用户名 */
                     username: String,

                     /** 密码 */
                     password: String,

                     /** 缓存的数据库statement个数 */
                     prepStmtCacheSize: Int,

                     /** 缓存的数据库语句最大长度 */
                     prepStmtCacheSqlLimit: Int,

                     /** 最多能够保持的连接数目，建议=服务器的CPU核数*2+1 */
                     maximumPoolSize: Int,

                     /** connection的最长存活时间 */
                     connectionLiveMinutes: Int,

                     /** 服务器最多能够同时接受多少请求，这个数字可以大一点防止成为并发的瓶颈 */
                     maximumServerConnection: Int = 20000,
                   )

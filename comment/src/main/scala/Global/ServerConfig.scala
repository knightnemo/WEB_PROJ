package Global

import io.circe.generic.auto.*

/** 配置文件 */
case class ServerConfig(
                         /** 服务器地址 */
                         serverIP: String,

                         /** 服务器端口 */
                         serverPort: Int,

                         /** 最大连接数 */
                         maximumServerConnection: Int,

                         /** 最大的同时往内部微服务发送的请求个数，原则上和最大连接数相同 */
                         maximumClientConnection: Int,
                       )
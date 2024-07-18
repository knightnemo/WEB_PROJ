package Common.API

import Common.DBAPI.DidRollbackException
import Common.ServiceUtils.getURI
import cats.effect.*
import io.circe.syntax.*
import io.circe.{Decoder, Encoder, Json}
import org.http4s.*
import org.http4s.Uri.Path
import org.http4s.circe.*
import org.http4s.circe.CirceEntityDecoder.*
import org.http4s.client.Client
import org.http4s.ember.client.EmberClientBuilder
import org.typelevel.log4cats.slf4j.{Slf4jFactory, Slf4jLogger}
import org.typelevel.log4cats.{Logger, LoggerFactory}

import scala.concurrent.duration.DurationInt

// 创建一个logger工厂，使用Slf4j
implicit val loggerFactory: LoggerFactory[IO] = Slf4jFactory.create[IO]

import scala.compiletime.erasedValue

/** API的基本类型，保存了API返回的数据类型 ReturnType */
abstract class API[T: Decoder](targetService: String):
  // 定义返回类型
  type ReturnType = T

  /** 表示当前API是否会产生回复。如果不会产生回复，则这里会复写成false */
  inline def hasReply: Boolean =
    inline erasedValue[ReturnType] match
      case _: Unit => true
      case _ => false

  // 获取带有API消息名称的URI
  def getURIWithAPIMessageName: IO[Uri] =
    for {
      baseUri <- getURI(targetService) // 获取基本URI
      newPath = baseUri.path.concat(Path.unsafeFromString("/api/" + this.getClass.getSimpleName.stripPrefix("/"))) // 构建新的路径
      updatedUri = baseUri.withPath(newPath) // 更新URI
    } yield updatedUri

  // 发送请求的方法
  def send(using Encoder[this.type], PlanContext): IO[T] = API.send[T, this.type](this)

object API {
  // 定义一个响应处理器的trait
  trait ResponseHandler[T]:
    def handle(response: Response[IO]): IO[T]

  // 处理字符串响应的实例
  given ResponseHandler[String] with
    def handle(response: Response[IO]): IO[String] = response.bodyText.compile.string

  // 处理泛型响应的实例，要求有Decoder
  given [T: Decoder]: ResponseHandler[T] with
    def handle(response: Response[IO]): IO[T] = {
      response.asJsonDecode[T].flatMap {
        IO(_) // 解码JSON并返回
      }
    }

  // 可选的HTTP客户端
  private var client: Option[Client[IO]] = None

  // 初始化HTTP客户端的方法，设置最大连接数等参数
  def init(maximumClientConnection:Int): IO[Unit] = {
    val clientResource: Resource[IO, Client[IO]] = EmberClientBuilder.default[IO]
      .withMaxTotal(maximumClientConnection)
      .withTimeout(30.seconds)
      .withIdleConnectionTime(30.seconds)
      .build

    clientResource.use { httpClient =>
      IO {
        client = Some(httpClient) // 设置HTTP客户端
      }
    }
  }

  // 创建日志记录器
  private given logger: Logger[IO] = Slf4jLogger.getLogger[IO]

  // 发送请求的具体实现
  def send[T: Decoder, A <: API[T] : Encoder](message: A)(using context: PlanContext): IO[T] =
    for {
      _ <- logger.info(s"Preparing to send message ${message}") // 记录准备发送的信息
      uri <- message.getURIWithAPIMessageName // 获取带有API消息名称的URI
      modifiedJson = message.asJson.mapObject { jsonObj => // 将消息编码为JSON并添加上下文信息
        val planContext = Json.obj(
          "traceID" -> context.traceID.asJson,
          "transactionLevel" -> Json.fromInt(context.transactionLevel)
        )
        jsonObj.add("planContext", planContext)
      }
      request = Request[IO](Method.POST, uri).withEntity(modifiedJson) // 创建POST请求

      result <- client.get.run(request).use { response => // 运行客户端并使用响应
        val handler = summon[ResponseHandler[T]] // 召唤一个响应处理器
        response.status match {
          case status if status.isSuccess =>
            response.bodyText.compile.string.flatMap { body =>
              IO.println(s"Response body: $body") // 打印响应体
            } >>
              handler.handle(response) // 处理成功的响应
          case _ =>
            response.bodyText.compile.string.flatMap { body =>
              (if (body.startsWith(DidRollbackException.prefix))
                IO.raiseError(DidRollbackException(new Exception(s"${body.substring(DidRollbackException.prefix.length)}"))) // 处理回滚异常
              else
                IO.raiseError(new Exception(s"Unexpected response status: ${response.status.code}, body: $body"))) // 处理其他异常
            }
        }
      }
    } yield result // 返回结果
}

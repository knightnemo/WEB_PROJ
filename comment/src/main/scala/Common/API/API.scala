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

implicit val loggerFactory: LoggerFactory[IO] = Slf4jFactory.create[IO]

import scala.compiletime.erasedValue

/** API的基本类型，保存了API返回的数据类型 ReturnType */
abstract class API[T: Decoder](targetService: String):
  type ReturnType = T

  /** 表示当前API是否会产生回复。如果不会产生回复，则这里会复写成false */
  inline def hasReply: Boolean =
    inline erasedValue[ReturnType] match
      case _: Unit => true
      case _ => false

  def getURIWithAPIMessageName: IO[Uri] =
    for {
      baseUri <- getURI(targetService)
      newPath = baseUri.path.concat(Path.unsafeFromString("/api/" + this.getClass.getSimpleName.stripPrefix("/")))
      updatedUri = baseUri.withPath(newPath)
    } yield updatedUri

  def send(using Encoder[this.type], PlanContext): IO[T] = API.send[T, this.type](this)

object API {
  trait ResponseHandler[T]:
    def handle(response: Response[IO]): IO[T]

  given ResponseHandler[String] with
    def handle(response: Response[IO]): IO[String] = response.bodyText.compile.string

  given [T: Decoder]: ResponseHandler[T] with
    def handle(response: Response[IO]): IO[T] = {
      response.asJsonDecode[T].flatMap {
        IO(_)
      }
    }

  private var client: Option[Client[IO]] = None

  def init(maximumClientConnection:Int): IO[Unit] = {
    val clientResource: Resource[IO, Client[IO]] = EmberClientBuilder.default[IO]
      .withMaxTotal(maximumClientConnection)
      .withTimeout(30.seconds)
      .withIdleConnectionTime(30.seconds)
      .build

    clientResource.use { httpClient =>
      IO {
        client = Some(httpClient)
      }
    }
  }

  private given logger: Logger[IO] = Slf4jLogger.getLogger[IO]

  def send[T: Decoder, A <: API[T] : Encoder](message: A)(using context: PlanContext): IO[T] =
    for {
      _ <- logger.info(s"Preparing to send message ${message}")
      uri <- message.getURIWithAPIMessageName
      modifiedJson = message.asJson.mapObject { jsonObj =>
        val planContext = Json.obj(
          "traceID" -> context.traceID.asJson,
          "transactionLevel" -> Json.fromInt(context.transactionLevel)
        )
        jsonObj.add("planContext", planContext)
      }
      request = Request[IO](Method.POST, uri).withEntity(modifiedJson)

      result <- client.get.run(request).use { response =>
        val handler = summon[ResponseHandler[T]] // Summon an instance of ResponseHandler for T
        response.status match {
          case status if status.isSuccess =>
            response.bodyText.compile.string.flatMap { body =>
              IO.println(s"Response body: $body")
            } >>
              handler.handle(response)
          case _ =>
            response.bodyText.compile.string.flatMap { body =>
              (if (body.startsWith(DidRollbackException.prefix))
                IO.raiseError(DidRollbackException(new Exception(s"${body.substring(DidRollbackException.prefix.length)}")))
              else
                IO.raiseError(new Exception(s"Unexpected response status: ${response.status.code}, body: $body")))
            }
        }
      }
    } yield result
}
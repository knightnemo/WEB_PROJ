package Process

import Common.API.{PlanContext, TraceID}
import Common.DBAPI.DidRollbackException
import Global.ServiceCenter.address
import Process.Server.proxyStream
import cats.effect.*
import io.circe.Json
import io.circe.generic.auto.*
import io.circe.syntax.*
import org.http4s.*
import org.http4s.Method.GET
import org.http4s.circe.CirceEntityCodec.*
import org.http4s.client.Client
import org.http4s.dsl.io.*
import org.http4s.headers.`Content-Type`

import java.util.UUID

object PortalService {
  def service(client: Client[IO]): HttpRoutes[IO] = HttpRoutes.of[IO] {
    case GET -> Root / "stream" / serviceName / streamName =>
      IO.println("Proxying request") >>
        Ok(proxyStream(client, serviceName, streamName))

    case req@POST -> Root / "api" / serviceName / messageName =>
      println(s"got message $serviceName $messageName")
      handlePostRequest(client, req, serviceName, messageName).flatMap {
        case Right(json) => Ok(json)
        case Left(e) => internalServerError(e)
      }.handleErrorWith { e =>
        internalServerError(e)
      }
  }

  def handlePostRequest(client: Client[IO], req: Request[IO], serviceName: String, messageName: String): IO[Either[Throwable, Json]] = {
    for {
      bodyJson <- req.as[Json]
      planContext = PlanContext(TraceID(UUID.randomUUID().toString), transactionLevel = 0)
      planContextJson = planContext.asJson
      updatedJson = bodyJson.deepMerge(Json.obj("planContext" -> planContextJson))
      _ <- IO.println(updatedJson)
      newUri <- IO.fromEither(Uri.fromString("http://" + address(serviceName) + "/api/" + messageName))
      _ <- IO.println(newUri)
      response <- sendRequest(client, newUri, updatedJson)
    } yield response
  }

  def sendRequest(client: Client[IO], uri: Uri, json: Json): IO[Either[Throwable, Json]] = {
    val newReq = Request[IO](method = Method.POST, uri = uri).withEntity(json)
    println("running")
    client.run(newReq).use { response =>
      println("here")
      println(response.status)
      println(response)
      if (response.status.isSuccess) {
        response.as[Json].attempt.map(_.left.map(err => new Exception(s"JSON parsing error: ${err.getMessage}", err)))
      } else {
        response.bodyText.compile.string.map(bodyStr =>
          Left(new Exception(s"Received a non-success response: ${response.status}, Body: $bodyStr"))
        )
      }
    }.handleErrorWith(e => IO.pure(Left(new Exception(s"Error during request execution: ${e.getMessage}", e))))
  }

  def internalServerError(e: Throwable): IO[Response[IO]] = {
    println("internal server error"+ e)
    val errorMessage = Json.obj(
      "error" -> Json.fromString(s"${e.getMessage.replace(DidRollbackException.prefix, "")}")
    )
    IO.pure(
      Response[IO](status = Status.InternalServerError)
        .withEntity(errorMessage)
        .withContentType(`Content-Type`(MediaType.application.json, Charset.`UTF-8`))
    )
  }

}

package Process

import cats.effect.*
import fs2.{Pipe, Stream}
import org.http4s.*
import org.http4s.Method.*
import org.http4s.client.*
import org.http4s.ember.client.*
import org.http4s.implicits.*
import org.typelevel.log4cats.Logger
import org.typelevel.log4cats.slf4j.{Slf4jFactory, Slf4jLogger}

object StreamClient extends IOApp {
  given logger: Logger[IO] = Slf4jLogger.getLogger[IO]

  given Slf4jFactory[IO] = Slf4jFactory.create[IO]


  def splitByDelimiter[F[_]](delimiter: String): Pipe[F, String, String] =
    _.scan((List[String](), "")) { (acc, chunk) =>
      // Combine with previous incomplete chunk
      val combined = acc._2 + chunk
      // Split by delimiter
      val parts = combined.split(delimiter, 0)
      // If we have complete parts, emit them and carry forward the incomplete part
      if (parts.length > 1 || combined.endsWith(delimiter))
        if (parts.length > 1)
          (parts.init.toList, parts.last) // Return the last incomplete part to be combined with the next chunk
        else
          (parts.toList, "") // Return the whole
      else
        (List(), combined) // Carry forward the combined data if no delimiter was found
    }.flatMap(acc => Stream.emits(acc._1).covary[F])

  def streamUpdates(client: Client[IO]): Stream[IO, Unit] = {
    val request = Request[IO](GET, uri"http://127.0.0.1:10008/stream/TongWen/tmp1")

    // Using the client to stream the response
    client.stream(request).flatMap { response =>
      // Assuming the response body is plain text, not JSON.
      // Adjust accordingly if your server sends a different format.
      response.bodyText
        .through(splitByDelimiter("<END>"))
        .evalMap { update =>
          IO(println(s"Received update: $update"))
        }
    }
  }

  override def run(args: List[String]): IO[ExitCode] = {
    EmberClientBuilder.default[IO].build.use { client =>
      streamUpdates(client).compile.drain
    }.as(ExitCode.Success)
  }
}

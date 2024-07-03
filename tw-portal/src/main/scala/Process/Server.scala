package Process

import Global.ServiceCenter.address
import Process.PortalService.service
import cats.effect.*
import com.comcast.ip4s.*
import fs2.Stream
import fs2.concurrent.Topic
import org.http4s.*
import org.http4s.Method.GET
import org.http4s.client.Client
import org.http4s.ember.client.*
import org.http4s.ember.server.*
import org.http4s.implicits.*
import org.http4s.server.middleware.CORS
import org.typelevel.log4cats.Logger
import org.typelevel.log4cats.slf4j.{Slf4jFactory, Slf4jLogger}

import scala.collection.concurrent.TrieMap
import scala.concurrent.duration.*

object Server extends IOApp {
  given logger: Logger[IO] = Slf4jLogger.getLogger[IO]

  given Slf4jFactory[IO] = Slf4jFactory.create[IO]

  val topics: TrieMap[(String, String), Topic[IO, Byte]] = TrieMap.empty

  def proxyStream(client: Client[IO], serviceName: String, streamName: String, maxRetries: Int = 100): Stream[IO, Byte] = {
    val targetUri = Uri.unsafeFromString(s"http://${address(serviceName)}/stream/$streamName")
    val request = Request[IO](GET, targetUri)

    def streamAndPublish(attempt: Int, topic: Topic[IO,Byte]): IO[Unit] = {
      client.stream(request).flatMap { response =>
        response.body.through(topic.publish)
      }.compile.drain.handleErrorWith { err =>
        if (attempt <= maxRetries) {
          IO.println(s"Attempt $attempt failed, retrying...") >>
            IO.sleep((attempt * 1000).millis) >> // Linear back-off
            streamAndPublish(attempt + 1, topic) // Retry with updated attempt count
        } else {
          IO.raiseError(new Exception(s"After $maxRetries attempts, failed to connect to $serviceName/$streamName: ${err.getMessage}", err))
        }
      }
    }

    def attemptStream(connectionAttempt: Int = 1): IO[Topic[IO, Byte]] = {
      topics.get((serviceName, streamName)) match {
        case Some(existingTopicIO) =>
          // Use existing topic if available
          IO.pure(existingTopicIO)
        case None =>
          // Create and store new topic if it doesn't exist
          Topic[IO, Byte].flatMap { newTopic =>
            for {
              _ <- IO(topics.putIfAbsent((serviceName, streamName), newTopic).getOrElse(newTopic))

              // Start streaming and publishing in a separate fiber
              _ <- streamAndPublish(1, newTopic).start
              _ <- IO.println("Starting a new stream!")
            } yield newTopic
          }
      }
    }

    Stream.eval(attemptStream()).flatMap { topic =>
      // Subscribe to the topic
      println("Subscribed to the new topic!!")
      topic.subscribe(10)
    }
  }


  def httpApp(client: Client[IO]): HttpApp[IO] = service(client).orNotFound


  override def run(args: List[String]): IO[ExitCode] = {
    Utils.readConfig(args.headOption.getOrElse("server_config.json"))
      .flatMap { config =>
        IO.println(s"Starting server on ${config.serverIP}:${config.serverPort}") *>
          (for {
            client: Client[IO] <- EmberClientBuilder.default[IO]
              .withMaxTotal(config.maximumClientConnection)
              .withIdleTimeInPool(30.minutes)
              .withIdleConnectionTime(30.minutes)
              .withTimeout(30.minutes)
              .build

            app <- Resource.eval(CORS.policy.withAllowOriginAll(httpApp(client)))

            server <- EmberServerBuilder.default[IO]
              .withHost(Host.fromString(config.serverIP).getOrElse(
                throw new IllegalArgumentException(s"Invalid IPv4 address: ${config.serverIP}")
              ))
              .withPort(Port.fromInt(config.serverPort).getOrElse(
                throw new IllegalArgumentException(s"Invalid port: ${config.serverPort}")
              ))
              .withIdleTimeout(30.minutes)
              .withShutdownTimeout(30.minutes)
              .withRequestHeaderReceiveTimeout(30.minutes)
              .withMaxConnections(config.maximumServerConnection)
              .withHttpApp(app)
              .build
          } yield server)
            .use(_ => IO.never)
            .as(ExitCode.Success)
      }
  }

}

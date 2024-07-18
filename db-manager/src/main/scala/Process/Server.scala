package Process

import Common.ServiceUtils.getPort
import Global.ServiceCenter
import SourceUtils.{createDataSource, initDB}
import Global.GlobalVariables.serviceCode
import Impl.Routes.{JsonStringEncoder, Routes}
import cats.effect.*
import com.comcast.ip4s.*
import org.http4s.blaze.server.BlazeServerBuilder
import org.http4s.implicits.*
import org.http4s.server.Router

import java.sql.Connection
import scala.concurrent.duration.*

object Server extends IOApp {
  // Main program logic
  override def run(args: List[String]): IO[ExitCode] =
    Utils.readConfig(args.headOption.getOrElse("default_config.json")).flatMap { defaultConfig =>
      createDataSource(defaultConfig).use { dataSource =>
        // Acquire and automatically release the connection using Resource
        Resource.make(IO(dataSource.getConnection))(conn => IO(conn.close())).use { connection =>
          for {
            _ <- IO.println(getPort(serviceCode))
            connectionMap <- Ref.of[IO, Map[String, Connection]](Map.empty)
            server <- BlazeServerBuilder[IO]
              .bindHttp(10001, "0.0.0.0")
              .withHttpApp(Router("/" -> Routes.service(dataSource, connectionMap)).orNotFound)
//              .withMaxConnections(defaultConfig.maximumServerConnection)
//              .withBufferSize(1638400)
//              .withConnectorPoolSize(10000)
//              .withIdleTimeout(5.minutes)
//              .withResponseHeaderTimeout(5.minutes) // Note: Ember's 'requestHeaderReceiveTimeout' may correspond to Blaze's 'responseHeaderTimeout' or similar.
              .serve
              .compile
              .drain
              .as(ExitCode.Success)
          } yield server
        }
      }
    }.handleErrorWith { e =>
      IO(println(s"Server error: ${e.getMessage}")).as(ExitCode.Error) // Log the error and return an error exit code
    }
}
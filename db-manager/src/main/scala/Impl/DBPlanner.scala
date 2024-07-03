package Impl

import Common.API.{PlanContext, TraceID}
import cats.effect.{IO, Ref}

import java.sql.Connection

trait DBPlanner[ReturnType]:
  def planWithConnection(connection: Connection, connectionMap: Ref[IO, Map[String, Connection]]): IO[ReturnType]

  val planContext:PlanContext=PlanContext(TraceID(""), 0)


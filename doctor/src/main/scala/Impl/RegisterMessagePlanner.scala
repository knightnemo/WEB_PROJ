package Impl

import cats.effect.IO
import io.circe.generic.auto.*
import Common.API.{PlanContext, Planner}
import Common.DBAPI.{writeDB, readDBBoolean}
import Common.Object.SqlParameter
import Common.ServiceUtils.schemaName
import APIs.DoctorAPI.DoctorInfo

case class RegisterMessagePlanner(userName: String, password: String, bio: Option[String], override val planContext: PlanContext) extends Planner[String]:
  override def plan(using planContext: PlanContext): IO[String] = {
    val checkUserExists = readDBBoolean(
      s"SELECT EXISTS(SELECT 1 FROM ${schemaName}.user_name WHERE user_name = ?)",
      List(SqlParameter("String", userName))
    )

    checkUserExists.flatMap { exists =>
      if (exists) {
        IO.raiseError(new Exception("already registered"))
      } else {
        for {
          _ <- writeDB(
            s"INSERT INTO ${schemaName}.user_name (user_name, password) VALUES (?, ?)",
            List(SqlParameter("String", userName), SqlParameter("String", password))
          )
          _ <- writeDB(
            s"""
            INSERT INTO ${schemaName}.doctors 
            (user_name, bio, followers, following, review_count, slot1, slot2, slot3, slot4, slot5, slot6, slot7, slot8)
            VALUES (?, ?, 0, 0, 0, '0', '0', '0', '0', '0', '0', '0', '0')
            """,
            List(
              SqlParameter("String", userName),
              SqlParameter("String", bio.getOrElse(""))
            )
          )
        } yield "User registered successfully"
      }
    }
  }
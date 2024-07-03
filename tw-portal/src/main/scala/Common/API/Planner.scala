package Common.API

import cats.effect.{IO, Resource}
import org.http4s.client.Client

import java.util.UUID

trait Planner[ReturnType]:
  def plan(using planContext: PlanContext): IO[ReturnType]

  def fullPlan: IO[ReturnType] =
    IO.println(this) >> plan(using this.planContext)

  val planContext: PlanContext = PlanContext(TraceID(""), 0)
